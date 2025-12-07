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
        limit(500)
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
        { ok: false, error: "Not enough data to build a landing page yet." },
        { status: 400 }
      );
    }

    // 2) Aggregate per session
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
            s.avgScroll = (s.avgScroll + value) / 2;
          }
        }
      }

      if (e.eventType === "click") {
        bySession[e.sessionId].clicks += 1;
      }
    }

    const sessions = Object.values(bySession);
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

    const behaviourSummary = {
      totalSessions: count,
      avgScrollAll,
      avgClicksAll,
    };

    // 3) Call Gemini to design a new landing page version
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
You are designing a new experimental landing page version for a product called cMindX.

You get summary behaviour metrics from the current page:

${JSON.stringify(behaviourSummary, null, 2)}

Your job: create a *full landing page layout* (Build C / Build D style) that is more likely to convert.

Return ONLY valid JSON with this shape, no markdown:

{
  "slug": "build-c",                     // URL-safe slug
  "name": "Build C – higher intent",     // human name
  "pageTitle": "cMindX — Build C",
  "heroTitle": "Your best guess hero line",
  "heroSubtitle": "1–2 sentence supporting copy tuned from the behaviour data.",
  "primaryCta": "Primary CTA label",
  "secondaryCta": "Secondary CTA label",
  "sections": [
    {
      "type": "section",
      "title": "Section title",
      "body": "Short paragraph."
    },
    {
      "type": "bullets",
      "title": "What this version focuses on",
      "items": ["Bullet 1", "Bullet 2", "Bullet 3"]
    },
    {
      "type": "section",
      "title": "How cMindX uses live analytics",
      "body": "Explain in detail."
    },
    {
      "type": "cta",
      "title": "Ready to evolve your site?",
      "body": "Short CTA-style paragraph."
    }
  ]
}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const landingPage = parseJsonFromText(text);

    if (!landingPage.slug) {
      return NextResponse.json(
        { ok: false, error: "Model did not return a slug" },
        { status: 500 }
      );
    }

    const slug: string = String(landingPage.slug);
    const ref = doc(collection(db, "landingPages"), slug);

    await setDoc(ref, {
      ...landingPage,
      behaviourSummary,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      slug,
      landingPage,
    });
  } catch (e: any) {
    console.error("landing-page error:", e);
    return NextResponse.json(
      { ok: false, error: e.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
