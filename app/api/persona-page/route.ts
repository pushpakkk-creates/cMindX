import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  orderBy,
  limit,
  query,
  doc,
  setDoc,
} from "firebase/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";

type AnalyticsEvent = {
  sessionId: string;
  eventType: string;
  payload: Record<string, unknown>;
  ts: string;
  variantId?: string;
};

type SessionStats = {
  sessionId: string;
  avgScroll: number | null;
  clicks: number;
};

// tiny helper to safely parse Gemini response as JSON
function parseJsonFromText(text: string) {
  let raw = text.trim();
  raw = raw.replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
  return JSON.parse(raw);
}

export async function POST() {
  try {
    // 1) Load recent events
    const eventsSnap = await getDocs(
      query(
        collection(db, "events"),
        orderBy("ts", "desc"),
        limit(500) // last 500 events
      )
    );

    const events: AnalyticsEvent[] = eventsSnap.docs.map((d) => {
      const data = d.data() as any;
      return {
        sessionId: data.sessionId ?? "unknown",
        eventType: data.eventType ?? "unknown",
        payload: (data.payload ?? {}) as Record<string, unknown>,
        ts: data.ts ?? new Date().toISOString(),
        variantId: data.variantId,
      };
    });

    if (events.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Not enough data to build personas yet." },
        { status: 400 }
      );
    }

    // 2) Aggregate by session → avg scroll + clicks
    const bySession: Record<string, SessionStats> = {};

    for (const e of events) {
      if (!bySession[e.sessionId]) {
        bySession[e.sessionId] = {
          sessionId: e.sessionId,
          avgScroll: null,
          clicks: 0,
        };
      }

      if (e.eventType === "scroll") {
        const value = e.payload.scrollPercent as number | undefined;
        if (typeof value === "number") {
          const s = bySession[e.sessionId];
          if (s.avgScroll === null) {
            s.avgScroll = value;
          } else {
            // simple running average: average of existing + new
            s.avgScroll = (s.avgScroll + value) / 2;
          }
        }
      }

      if (e.eventType === "click") {
        bySession[e.sessionId].clicks += 1;
      }
    }

    const sessions = Object.values(bySession);

    // 3) Build a small numeric summary for prompt
    const count = sessions.length;
    const avgScrollAll =
      sessions.filter((s) => s.avgScroll !== null).length > 0
        ? sessions
            .filter((s) => s.avgScroll !== null)
            .reduce((sum, s) => sum + (s.avgScroll || 0), 0) /
          sessions.filter((s) => s.avgScroll !== null).length
        : null;

    const avgClicksAll =
      sessions.reduce((sum, s) => sum + s.clicks, 0) / count;

    // categorize sessions roughly
    const skimmers = sessions.filter(
      (s) => (s.avgScroll ?? 0) < 30
    ).length;
    const deepReaders = sessions.filter(
      (s) => (s.avgScroll ?? 0) >= 70
    ).length;
    const clicky = sessions.filter((s) => s.clicks >= 3).length;

    const behaviourSummary = {
      totalSessions: count,
      avgScrollAll,
      avgClicksAll,
      skimmers,
      deepReaders,
      clicky,
    };

    // 4) Call Gemini to design persona page
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Missing GEMINI_API_KEY" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const prompt = `
You are designing a persona-specific landing page for a product called cMindX.

You are given high-level behaviour stats from a marketing page:

${JSON.stringify(behaviourSummary, null, 2)}

From this, infer the *dominant* persona that we should build a dedicated page for.

Examples of persona patterns:
- "Bouncers / skimmers" → low scroll, low clicks
- "Explorers / deep readers" → high scroll, some clicks
- "High-intent clickers" → medium scroll, high clicks
- "Lurkers" → mid scroll, low clicks

Choose ONE persona that seems most strategically important and generate a *full page definition* for them.

Return ONLY valid JSON (no markdown, no extra text) with the following structure:

{
  "slug": "persona-high-intent",        // URL segment, kebab-case
  "personaName": "High-intent clickers",
  "pageTitle": "cMindX for High-Intent Visitors",
  "heroTitle": "Turn intent into action on every visit.",
  "heroSubtitle": "Explain in 1–2 sentences how cMindX helps THIS persona based on the behaviour data.",
  "primaryCta": "Start optimizing high-intent traffic",
  "secondaryCta": "See how it works for your funnel",
  "sections": [
    {
      "type": "section",
      "title": "Why this persona matters",
      "body": "Short paragraph."
    },
    {
      "type": "bullets",
      "title": "What cMindX does for them",
      "items": ["Bullet 1", "Bullet 2", "Bullet 3"]
    },
    {
      "type": "section",
      "title": "How it works behind the scenes",
      "body": "Short paragraph."
    },
    {
      "type": "cta",
      "title": "Ready to let your website adapt?",
      "body": "Short CTA copy encouraging action."
    }
  ]
}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const personaPage = parseJsonFromText(text);

    if (!personaPage.slug) {
      return NextResponse.json(
        { ok: false, error: "Model did not return a slug" },
        { status: 500 }
      );
    }

    // 5) Save to Firestore as personaPages/{slug}
    const slug: string = String(personaPage.slug);
    const ref = doc(collection(db, "personaPages"), slug);

    await setDoc(ref, {
      ...personaPage,
      behaviourSummary,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      slug,
      personaPage,
    });
  } catch (e: any) {
    console.error("persona-page error:", e);
    return NextResponse.json(
      { ok: false, error: e.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
