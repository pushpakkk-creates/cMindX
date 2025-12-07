import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  limit,
  orderBy,
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

export type LandingPageSpec = {
  hero: {
    title: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
    badge: string;
    strip: string;
  };
  system: {
    currentVariantLabel: string;
    dataSourceLabel: string;
    agentLabel: string;
    description: string;
  };
  pillars: {
    label: string;
    title: string;
    body: string;
  }[];
  stackPoints: string[];
  editCards: {
    title: string;
    body: string;
  }[];
};

function parseJson(text: string) {
  let clean = text.trim();
  clean = clean
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(clean);
}

function buildFallbackSpec(stats: VariantStats[]): LandingPageSpec {
  const winner = stats.sort(
    (a, b) =>
      b.avgScroll + 8 * b.clicks - (a.avgScroll + 8 * a.clicks)
  )[0] || {
    variantId: "A",
    avgScroll: 50,
    clicks: 5,
  };

  return {
    hero: {
      title: "A landing page that rewrites itself from live behaviour.",
      subtitle:
        "Instead of shipping static copy, cMindX watches how visitors scroll, click and drop off — then quietly evolves your hero, CTAs and above-the-fold layout based on what actually performs.",
      primaryCta: "View live dashboard",
      secondaryCta: "See how it works",
      badge: "Self-evolving website agent",
      strip: `Based on variant ${winner.variantId} · Scroll ${winner.avgScroll.toFixed(
        1
      )}% · Clicks ${winner.clicks}`,
    },
    system: {
      currentVariantLabel: `Variant ${winner.variantId}`,
      dataSourceLabel: "Firestore events & variants",
      agentLabel: "Gemini-powered evolution",
      description:
        "cMindX doesn’t replace your CMS. It sits in front of your marketing site and continuously answers the question: “What should this page say right now?”",
    },
    pillars: [
      {
        label: "Live traffic",
        title: "Your traffic becomes training data.",
        body: "Every scroll, click and exit event is tracked with the active variant ID and stored as clean analytics.",
      },
      {
        label: "Analytics → agent",
        title: "Behaviour becomes decisions.",
        body: "The agent reads engagement patterns per variant and infers which stories keep people on the page.",
      },
      {
        label: "New variants",
        title: "Copy evolves on its own.",
        body: "Gemini proposes new hero layouts and CTAs you can inspect, approve or let auto-deploy.",
      },
    ],
    stackPoints: [
      "Frontend: this landing page with a lightweight analytics hook.",
      "Storage: Firestore collections for events, variants and landing builds.",
      "Agent: Gemini-2.5-flash turns behaviour into new hero concepts.",
      "Control: dashboard to see performance, approve variants or enable auto-mode.",
    ],
    editCards: [
      {
        title: "Hero headline & subcopy",
        body: "The core promise of your product, tuned from real traffic instead of guesswork.",
      },
      {
        title: "Primary & secondary CTAs",
        body: "Button labels and framing that reflect what people actually click.",
      },
      {
        title: "Above-the-fold layout",
        body: "The first screen visitors see, optimised to reduce bounce and drive scroll.",
      },
      {
        title: "Variant history in Firestore",
        body: "Every AI build is stored with context so you can promote, roll back or compare.",
      },
    ],
  };
}

export async function POST() {
  try {
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
        if (!Number.isNaN(val)) byVariant[vId].scrolls.push(val);
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

    const apiKey = process.env.GEMINI_API_KEY;
    let spec: LandingPageSpec;
    let aiUsed: "gemini" | "fallback" = "fallback";
    let aiError: string | undefined;

    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
        });

        const prompt = `
You are designing the full textual content for a SaaS landing page called "cMindX", an AI agent that rewrites websites based on live behaviour analytics.

You are given aggregated A/B test stats:

${JSON.stringify(stats, null, 2)}

Use these patterns:
- If a variant has high scroll + high clicks, assume its narrative is strong.
- If a variant has high clicks but lower scroll, assume the hero is clear and fast to understand.
- Use that intuition to create a new Build C page spec.

Return ONLY JSON (no markdown fences) matching EXACTLY this TypeScript type:

{
  "hero": {
    "title": string,
    "subtitle": string,
    "primaryCta": string,
    "secondaryCta": string,
    "badge": string,
    "strip": string
  },
  "system": {
    "currentVariantLabel": string,
    "dataSourceLabel": string,
    "agentLabel": string,
    "description": string
  },
  "pillars": {
    "label": string,
    "title": string,
    "body": string
  }[],
  "stackPoints": string[],
  "editCards": {
    "title": string,
    "body": string
  }[]
}

Important style constraints:
- Keep text concise, product-focused and non-cringe.
- The tone should feel like a mix of Vercel / Linear / Apple: clear, calm, confident.
- Use British spelling for "optimisation" / "behaviour".
`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const parsed = parseJson(text);
        spec = parsed as LandingPageSpec;
        aiUsed = "gemini";
      } catch (err: any) {
        console.error("landing-agent gemini error:", err);
        spec = buildFallbackSpec(stats);
        aiError = String(err?.message || "Gemini error");
      }
    } else {
      spec = buildFallbackSpec(stats);
      aiError = "Missing GEMINI_API_KEY";
    }

    return NextResponse.json({
      ok: true,
      stats,
      spec,
      aiUsed,
      aiError,
    });
  } catch (e: any) {
    console.error("landing-agent route error:", e);
    return NextResponse.json(
      { ok: false, error: e.message || "Unknown error" },
      { status: 500 }
    );
  }
}
