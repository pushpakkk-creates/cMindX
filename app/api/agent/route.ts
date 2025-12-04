// app/api/agent/route.ts
import { NextResponse } from "next/server";
import { db } from "../../../lib/firebase";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { getAiModel } from "../../../lib/ai";

type VariantId = "A" | "B";

type AnalyticsEvent = {
  sessionId: string;
  eventType: string;
  payload: Record<string, unknown>;
  ts: string;
  variantId?: string;
};

type SimpleStats = {
  variantId: VariantId;
  avgScroll: number | null;
  clicks: number;
};

type AgentVariantSuggestion = {
  fromVariant: VariantId;
  heroTitle: string;
  heroSubtitle: string;
  primaryCta: string;
  secondaryCta: string;
  badge: string;
  meta: {
    basedOn: SimpleStats | null;
    explanation: string;
  };
};

// ---------- UTIL: compute stats from events ----------

async function getSimpleStats(): Promise<SimpleStats[]> {
  const q = query(collection(db, "events"), limit(500));
  const snap = await getDocs(q);
  const events = snap.docs.map((d) => d.data() as any) as AnalyticsEvent[];

  const byVariant: Record<VariantId, AnalyticsEvent[]> = { A: [], B: [] };

  for (const e of events) {
    const v = (e.variantId as VariantId | undefined) ?? "A";
    if (v === "A" || v === "B") {
      byVariant[v].push(e);
    }
  }

  const result: SimpleStats[] = [];

  for (const variantId of ["A", "B"] as VariantId[]) {
    const ve = byVariant[variantId];

    if (ve.length === 0) {
      result.push({ variantId, avgScroll: null, clicks: 0 });
      continue;
    }

    const scrollEvents = ve.filter((e) => e.eventType === "scroll");
    const scrollPercents = scrollEvents
      .map((e) => e.payload.scrollPercent as number | undefined)
      .filter((v): v is number => typeof v === "number");

    const avgScroll =
      scrollPercents.length > 0
        ? scrollPercents.reduce((sum, v) => sum + v, 0) /
          scrollPercents.length
        : null;

    const clicks = ve.filter((e) => e.eventType === "click").length;

    result.push({ variantId, avgScroll, clicks });
  }

  return result;
}

// ---------- MOCK AGENT (current behaviour) ----------

function pickWinner(stats: SimpleStats[]): SimpleStats | null {
  if (stats.length === 0) return null;

  return stats.reduce((best, cur) => {
    const bestScore = (best.avgScroll ?? 0) + best.clicks * 2;
    const curScore = (cur.avgScroll ?? 0) + cur.clicks * 2;
    return curScore > bestScore ? cur : best;
  });
}

function mockGenerateVariant(stats: SimpleStats[]): AgentVariantSuggestion {
  const winner = pickWinner(stats);
  const base = winner?.variantId ?? "A";

  return {
    fromVariant: base,
    heroTitle:
      base === "A"
        ? "SELF-EVOLVING WEBSITE // BUILD C"
        : "AUTONOMOUS GROWTH AGENT // BUILD C",
    heroSubtitle:
      "New variant evolved from the current winner, tuned to push players deeper into the page and increase interaction based on live analytics.",
    primaryCta: "▶ Deploy Build C",
    secondaryCta: "◎ Inspect experiment logs",
    badge: "AGENT MODE • EVOLUTION",
    meta: {
      basedOn: winner ?? null,
      explanation:
        "Mock agent: uses heuristic score (scroll depth + clicks) to evolve a new Build C from the current winning variant."
    }
  };
}

// ---------- GEMINI-POWERED AGENT (with safe fallback) ----------

async function generateVariantWithGemini(
  stats: SimpleStats[]
): Promise<AgentVariantSuggestion> {
  const model = getAiModel();
  if (!model) {
    throw new Error("No Gemini model available");
  }

  const statsJson = JSON.stringify(stats, null, 2);

  const prompt = `
You are an expert SaaS landing-page copywriter for a product called cMindX
that automatically rewrites websites based on live analytics.

We have two variants A and B. For each we tracked:
- avgScroll (roughly attention / depth)
- clicks (CTA / link interactions)

Here are the aggregated stats per variant (JSON):

${statsJson}

Task:
Generate a NEW hero variant called "Build C" that should improve engagement
(higher scroll) and intent (more clicks).

Return ONLY valid JSON with this exact shape:

{
  "heroTitle": "ONE LINE, in ALL CAPS or with symbols like // or ▶, game/HUD vibe",
  "heroSubtitle": "2–3 short lines, clear value of cMindX and how it works",
  "primaryCta": "Short button label, ideally starting with a symbol like ▶",
  "secondaryCta": "Short safety-net action label (e.g., '◎ Watch experiments')",
  "badge": "Short ALL CAPS label, e.g. 'AGENT MODE • EVOLUTION'"
}

No extra text, no comments, no markdown fences.
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // Clean possible ```json ... ``` wrappers
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  let parsed: {
    heroTitle: string;
    heroSubtitle: string;
    primaryCta: string;
    secondaryCta: string;
    badge: string;
  };

  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse Gemini JSON, raw text:", text);
    throw e;
  }

  const winner = pickWinner(stats);

  return {
    fromVariant: winner?.variantId ?? "A",
    heroTitle: parsed.heroTitle,
    heroSubtitle: parsed.heroSubtitle,
    primaryCta: parsed.primaryCta,
    secondaryCta: parsed.secondaryCta,
    badge: parsed.badge,
    meta: {
      basedOn: winner ?? null,
      explanation:
        "Gemini-generated Build C: based on live stats (avg scroll + clicks) to increase engagement and interaction."
    }
  };
}

// ---------- API HANDLER ----------

export async function GET() {
  try {
    const stats = await getSimpleStats();

    let suggestedVariant: AgentVariantSuggestion;
    let usedAI = false;
    let aiError: string | null = null;

    // Try Gemini first; if anything fails, fall back to mock agent
    try {
      suggestedVariant = await generateVariantWithGemini(stats);
      usedAI = true;
    } catch (e: any) {
      console.error("Gemini agent failed, falling back to mock heuristic.", e);
      aiError = String(e);
      suggestedVariant = mockGenerateVariant(stats);
    }

    return NextResponse.json({
      ok: true,
      stats,
      suggestedVariant,
      aiUsed: usedAI ? "gemini" : "mock",
      aiError
    });
  } catch (e) {
    console.error("Agent route fatal error", e);
    return NextResponse.json(
      { ok: false, error: String(e) },
      { status: 500 }
    );
  }
}
