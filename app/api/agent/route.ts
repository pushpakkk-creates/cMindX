import { NextResponse } from "next/server";
import { db } from "../../../lib/firebase";
import { collection, getDocs, limit, query } from "firebase/firestore";

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

// For now: simple heuristic instead of real LLM.
// Later we swap this with a Gemini/GPT call.
function mockGenerateVariant(stats: SimpleStats[]) {
  if (stats.length === 0) {
    return {
      fromVariant: "A" as VariantId,
      heroTitle: "SELF-EVOLVING WEBSITE // BUILD C",
      heroSubtitle:
        "New variant generated without much data. Designed as a neutral starting point.",
      primaryCta: "▶ Activate Variant C",
      secondaryCta: "◎ Compare with current build",
      badge: "AGENT MODE • MUTATION",
      meta: {
        basedOn: null,
        explanation:
          "Insufficient data, so we use a generic but strong conversion-focused variant."
      }
    };
  }

  const winner = stats.reduce((best, cur) => {
    const scoreBest =
      (best.avgScroll ?? 0) + best.clicks * 2;
    const scoreCur =
      (cur.avgScroll ?? 0) + cur.clicks * 2;
    return scoreCur > scoreBest ? cur : best;
  });

  const base = winner.variantId;

  return {
    fromVariant: base,
    heroTitle:
      base === "A"
        ? "SELF-EVOLVING WEBSITE // BUILD C"
        : "AUTONOMOUS GROWTH AGENT // BUILD C",
    heroSubtitle:
      "New variant generated from the current winner, tuned to push players deeper into the page and increase interaction.",
    primaryCta: "▶ Activate Variant C",
    secondaryCta: "◎ Run side-by-side test",
    badge: "AGENT MODE • MUTATION",
    meta: {
      basedOn: winner,
      explanation:
        "This mock variant assumes that higher scroll and click scores indicate a stronger narrative. It amplifies urgency and clarity from the winning variant."
    }
  };
}

export async function GET() {
  try {
    const stats = await getSimpleStats();
    const suggestedVariant = mockGenerateVariant(stats);

    // later:
    // 1. build LLM prompt from `stats`
    // 2. call Gemini/GPT
    // 3. parse into new variant
    // 4. save to Firestore `variants` collection

    return NextResponse.json({
      ok: true,
      stats,
      suggestedVariant
    });
  } catch (e) {
    console.error("Agent error", e);
    return NextResponse.json(
      { ok: false, error: "Agent failed" },
      { status: 500 }
    );
  }
}
