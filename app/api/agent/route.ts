import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  orderBy,
  limit,
  query,
} from "firebase/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";

type AnalyticsEvent = {
  sessionId: string;
  eventType: string;
  payload: Record<string, any>;
  ts: string;
  variantId?: string;
};

type VariantStats = {
  variantId: string;
  avgScroll: number;
  clicks: number;
};

type SuggestedVariant = {
  fromVariant: string;
  heroTitle: string;
  heroSubtitle: string;
  primaryCta: string;
  secondaryCta: string;
  badge: string;
  meta?: any;
};

function parseJson(text: string) {
  let clean = text.trim();
  clean = clean
    .replace(/^```json/, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();
  return JSON.parse(clean);
}

// Simple heuristic winner if Gemini fails
function buildMockSuggestion(stats: VariantStats[]): {
  suggestedVariant: SuggestedVariant;
  aiUsed: "mock";
  aiError?: string;
} {
  if (stats.length === 0) {
    const suggestedVariant: SuggestedVariant = {
      fromVariant: "A",
      heroTitle: "SELF-EVOLVING WEBSITE // BUILD C",
      heroSubtitle:
        "New variant evolved from the current winner, tuned to push visitors deeper into the page and increase interaction based on live analytics.",
      primaryCta: "▶ Deploy Build C",
      secondaryCta: "◎ Inspect experiment logs",
      badge: "AGENT MODE • EVOLUTION",
      meta: {
        basedOn: null,
        explanation:
          "Mock agent: assumes that high scroll + clicks correlate with better engagement.",
      },
    };
    return { suggestedVariant, aiUsed: "mock" };
  }

  // Score: avgScroll + 10 * clicks
  const withScore = stats.map((s) => ({
    ...s,
    score: s.avgScroll + 10 * s.clicks,
  }));
  withScore.sort((a, b) => b.score - a.score);
  const winner = withScore[0];

  const suggestedVariant: SuggestedVariant = {
    fromVariant: winner.variantId,
    heroTitle: "AUTONOMOUS GROWTH AGENT // BUILD C",
    heroSubtitle:
      "New variant evolved from the current winning variant, tuned from live scroll and click behaviour to drive deeper engagement.",
    primaryCta: "▶ Deploy Build C",
    secondaryCta: "◎ Inspect experiment logs",
    badge: "AGENT MODE • EVOLUTION",
    meta: {
      basedOn: winner,
      explanation:
        "Mock agent: uses a heuristic score (avg scroll + 10×clicks) to choose the best-performing variant and then proposes Build C from it.",
    },
  };

  return { suggestedVariant, aiUsed: "mock" };
}

export async function POST() {
  try {
    // 1) Load recent events
    const snap = await getDocs(
      query(collection(db, "events"), orderBy("ts", "desc"), limit(500))
    );

    const events: AnalyticsEvent[] = snap.docs.map((d) => d.data() as any);

    if (events.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Not enough events yet." },
        { status: 400 }
      );
    }

    // 2) Aggregate stats per variantId (A/B)
    const byVariant: Record<
      string,
      { scrolls: number[]; clicks: number; count: number }
    > = {};

    for (const e of events) {
      const vId = e.variantId || "unknown";
      if (!byVariant[vId]) {
        byVariant[vId] = { scrolls: [], clicks: 0, count: 0 };
      }

      if (e.eventType === "scroll") {
        const val = Number(e.payload.scrollPercent ?? 0);
        if (!Number.isNaN(val)) {
          byVariant[vId].scrolls.push(val);
        }
      }

      if (e.eventType === "click") {
        byVariant[vId].clicks += 1;
      }

      byVariant[vId].count += 1;
    }

    const stats: VariantStats[] = Object.entries(byVariant).map(
      ([variantId, agg]) => {
        const avgScroll =
          agg.scrolls.length > 0
            ? agg.scrolls.reduce((a, b) => a + b, 0) / agg.scrolls.length
            : 0;
        return {
          variantId,
          avgScroll,
          clicks: agg.clicks,
        };
      }
    );

    // 3) Try Gemini first, fallback to mock
    let suggestedVariant: SuggestedVariant;
    let aiUsed: "mock" | "gemini" = "mock";
    let aiError: string | undefined;

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
        });

        const prompt = `
You are optimizing a landing page for a product called cMindX.

You get aggregated A/B stats:
${JSON.stringify(stats, null, 2)}

Pick the best-performing variantId and propose a new "Build C" hero variant based on it.

Return ONLY JSON, no markdown, with this shape:

{
  "fromVariant": "A",
  "heroTitle": "SELF-EVOLVING WEBSITE // BUILD C",
  "heroSubtitle": "1-2 sentence explanation tuned from the stats.",
  "primaryCta": "Primary button label",
  "secondaryCta": "Secondary button label",
  "badge": "Short label, e.g. AGENT MODE • EVOLUTION",
  "meta": {
    "basedOn": { "variantId": "...", "avgScroll": 0, "clicks": 0 },
    "explanation": "Short explanation of how behaviour informed this variant."
  }
}
`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const parsed = parseJson(text);

        // minimal validation
        if (
          parsed.heroTitle &&
          parsed.heroSubtitle &&
          parsed.primaryCta &&
          parsed.secondaryCta
        ) {
          suggestedVariant = parsed;
          aiUsed = "gemini";
        } else {
          const mock = buildMockSuggestion(stats);
          suggestedVariant = mock.suggestedVariant;
          aiUsed = mock.aiUsed;
          aiError = "Gemini returned incomplete JSON, used mock heuristic.";
        }
      } catch (err: any) {
        console.error("Gemini error:", err);
        const mock = buildMockSuggestion(stats);
        suggestedVariant = mock.suggestedVariant;
        aiUsed = mock.aiUsed;
        aiError = String(err?.message || "Gemini call failed");
      }
    } else {
      const mock = buildMockSuggestion(stats);
      suggestedVariant = mock.suggestedVariant;
      aiUsed = mock.aiUsed;
      aiError = "Missing GEMINI_API_KEY, using mock heuristic.";
    }

    return NextResponse.json({
      ok: true,
      stats,
      suggestedVariant,
      aiUsed,
      aiError,
    });
  } catch (e: any) {
    console.error("agent route error:", e);
    return NextResponse.json(
      { ok: false, error: e.message || "Unknown error in agent." },
      { status: 500 }
    );
  }
}
