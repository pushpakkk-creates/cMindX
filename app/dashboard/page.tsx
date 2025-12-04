"use client";

import React, { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit
} from "firebase/firestore";

type AnalyticsEvent = {
  sessionId: string;
  eventType: string;
  payload: Record<string, unknown>;
  ts: string;
  variantId?: string;
};

type VariantId = "A" | "B";

type VariantStats = {
  variantId: VariantId;
  totalEvents: number;
  sessions: number;
  scrollEvents: number;
  avgScrollPercent: number | null;
  clickEvents: number;
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

type AgentResponse = {
  ok: boolean;
  stats: SimpleStats[];
  suggestedVariant: AgentVariantSuggestion;
};

function computeVariantStats(events: AnalyticsEvent[]): VariantStats[] {
  const byVariant: Record<VariantId, AnalyticsEvent[]> = {
    A: [],
    B: []
  };

  for (const e of events) {
    const v = (e.variantId as VariantId | undefined) ?? "A";
    if (v === "A" || v === "B") {
      byVariant[v].push(e);
    }
  }

  const stats: VariantStats[] = [];

  for (const variantId of ["A", "B"] as VariantId[]) {
    const ve = byVariant[variantId];
    if (ve.length === 0) {
      stats.push({
        variantId,
        totalEvents: 0,
        sessions: 0,
        scrollEvents: 0,
        avgScrollPercent: null,
        clickEvents: 0
      });
      continue;
    }

    const sessionSet = new Set(ve.map((e) => e.sessionId));

    const scrollEvents = ve.filter((e) => e.eventType === "scroll");
    const scrollPercents = scrollEvents
      .map((e) => e.payload.scrollPercent as number | undefined)
      .filter((v): v is number => typeof v === "number");
    const avgScroll =
      scrollPercents.length > 0
        ? scrollPercents.reduce((sum, v) => sum + v, 0) /
          scrollPercents.length
        : null;

    const clickEvents = ve.filter((e) => e.eventType === "click").length;

    stats.push({
      variantId,
      totalEvents: ve.length,
      sessions: sessionSet.size,
      scrollEvents: scrollEvents.length,
      avgScrollPercent: avgScroll,
      clickEvents
    });
  }

  return stats;
}

export default function DashboardPage() {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [agentLoading, setAgentLoading] = useState(false);
  const [agentData, setAgentData] = useState<AgentResponse | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);

  async function loadEvents() {
    try {
      const q = query(
        collection(db, "events"),
        orderBy("ts", "desc"),
        limit(200)
      );
      const snap = await getDocs(q);
      const loaded: AnalyticsEvent[] = snap.docs.map((doc) => {
        const data = doc.data() as any;
        return {
          sessionId: data.sessionId ?? "unknown",
          eventType: data.eventType ?? "unknown",
          payload: (data.payload ?? {}) as Record<string, unknown>,
          ts: data.ts ?? new Date().toISOString(),
          variantId: data.variantId
        };
      });
      setEvents(loaded);
    } catch (e) {
      console.error("Failed to load events from Firestore", e);
    } finally {
      setLoading(false);
    }
  }

  async function runAgent() {
    try {
      setAgentError(null);
      setAgentLoading(true);
      const res = await fetch("/api/agent");
      const json: AgentResponse = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error("Agent returned error");
      }
      setAgentData(json);
    } catch (err) {
      console.error(err);
      setAgentError("Agent failed to generate a suggestion.");
    } finally {
      setAgentLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
    const id = setInterval(loadEvents, 5000);
    return () => clearInterval(id);
  }, []);

  const totalEvents = events.length;
  const uniqueSessions = new Set(events.map((e) => e.sessionId)).size;
  const variantStats = computeVariantStats(events);

  const winner =
    variantStats.length === 2 &&
    variantStats[0].avgScrollPercent !== null &&
    variantStats[1].avgScrollPercent !== null
      ? variantStats[0].avgScrollPercent > variantStats[1].avgScrollPercent
        ? variantStats[0].variantId
        : variantStats[1].variantId
      : null;

  return (
    <div className="retro-bg min-h-screen text-slate-50">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        {/* Top HUD bar */}
        <header className="mb-6 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-300">
          <div className="flex items-center gap-3">
            <div className="pixel-border flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-amber-500 to-rose-500 text-[10px] font-black">
              HUD
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-100">
                cMindX Analytics HUD
              </span>
              <div className="flex gap-2 text-[9px] text-slate-400">
                <span>MODE: LIVE TELEMETRY</span>
                <span className="text-lime-300">
                  EVENTS: {totalEvents}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[9px]">
            <span className="inline-flex items-center gap-1 text-slate-400">
              <span className="status-led" />
              STREAM: ACTIVE
            </span>
            <a
              href="/"
              className="rounded-sm border border-slate-600 bg-slate-900/60 px-3 py-1 text-[9px] font-semibold text-slate-200 hover:border-amber-400 hover:text-amber-200"
            >
              ⬅ BACK TO AGENT
            </a>
          </div>
        </header>

        {loading && (
          <p className="text-[11px] text-slate-300">Loading telemetry…</p>
        )}

        {!loading && (
          <>
            {/* Top stats row */}
            <section className="mb-8 grid gap-4 md:grid-cols-3 text-[11px]">
              <div className="retro-panel scanline-overlay border border-slate-700/80 p-4">
                <p className="text-[9px] uppercase tracking-[0.22em] text-slate-400">
                  TOTAL EVENTS
                </p>
                <p className="mt-2 text-2xl font-semibold text-amber-300">
                  {totalEvents}
                </p>
                <p className="mt-1 text-[9px] text-slate-500">
                  Pageviews, clicks and scrolls captured for this build.
                </p>
              </div>

              <div className="retro-panel scanline-overlay border border-slate-700/80 p-4">
                <p className="text-[9px] uppercase tracking-[0.22em] text-slate-400">
                  UNIQUE SESSIONS
                </p>
                <p className="mt-2 text-2xl font-semibold text-lime-300">
                  {uniqueSessions}
                </p>
                <p className="mt-1 text-[9px] text-slate-500">
                  Distinct visitors represented in the event log.
                </p>
              </div>

              <div className="retro-panel scanline-overlay hud-pulse border border-amber-500/70 p-4">
                <p className="text-[9px] uppercase tracking-[0.22em] text-slate-400">
                  CURRENT WINNER
                </p>
                <p className="mt-2 text-2xl font-semibold text-amber-200">
                  {winner ? `Variant ${winner}` : "—"}
                </p>
                <p className="mt-1 text-[9px] text-slate-500">
                  Based on higher average scroll depth across sessions.
                </p>
              </div>
            </section>

            {/* Variant performance cards */}
            <section className="mb-8">
              <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                VARIANT PERFORMANCE
              </h2>
              <div className="grid gap-4 md:grid-cols-2 text-[11px]">
                {variantStats.map((vs) => (
                  <div
                    key={vs.variantId}
                    className="retro-panel scanline-overlay border border-slate-700/80 p-4"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-50">
                        Variant {vs.variantId}
                      </p>
                      {winner === vs.variantId && (
                        <span className="rounded-full bg-lime-400/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-lime-300">
                          LEADING
                        </span>
                      )}
                    </div>
                    <p className="mb-3 text-[10px] text-slate-400">
                      Hero copy + CTA version {vs.variantId}. Tracked using live
                      scroll and click events.
                    </p>

                    <div className="grid grid-cols-2 gap-3 text-[11px]">
                      <div className="rounded border border-slate-700 bg-slate-950/60 px-3 py-2">
                        <p className="text-[9px] text-slate-400">SESSIONS</p>
                        <p className="text-sm font-semibold text-slate-50">
                          {vs.sessions}
                        </p>
                      </div>
                      <div className="rounded border border-slate-700 bg-slate-950/60 px-3 py-2">
                        <p className="text-[9px] text-slate-400">
                          TOTAL EVENTS
                        </p>
                        <p className="text-sm font-semibold text-slate-50">
                          {vs.totalEvents}
                        </p>
                      </div>
                      <div className="rounded border border-slate-700 bg-slate-950/60 px-3 py-2">
                        <p className="text-[9px] text-slate-400">
                          AVG SCROLL
                        </p>
                        <p className="text-sm font-semibold text-amber-200">
                          {vs.avgScrollPercent !== null
                            ? `${vs.avgScrollPercent.toFixed(1)}%`
                            : "—"}
                        </p>
                      </div>
                      <div className="rounded border border-slate-700 bg-slate-950/60 px-3 py-2">
                        <p className="text-[9px] text-slate-400">
                          CLICK EVENTS
                        </p>
                        <p className="text-sm font-semibold text-rose-200">
                          {vs.clickEvents}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* AI VARIANT LAB */}
            <section className="mb-8">
              <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                AI VARIANT LAB
              </h2>
              <div className="retro-panel scanline-overlay border border-lime-500/60 p-4 text-[11px]">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.22em] text-lime-300">
                      EXPERIMENTAL AGENT
                    </p>
                    <p className="text-xs font-semibold text-slate-50">
                      Generate next hero variant from live data.
                    </p>
                  </div>
                  <button
                    onClick={runAgent}
                    disabled={agentLoading}
                    className="pixel-border rounded-md bg-lime-400 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-950 hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {agentLoading ? "RUNNING…" : "RUN AGENT"}
                  </button>
                </div>

                {agentError && (
                  <p className="text-[10px] text-rose-300">{agentError}</p>
                )}

                {!agentError && agentData && (
                  <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                    <div className="rounded border border-slate-700 bg-slate-950/70 px-3 py-3">
                      <p className="mb-1 text-[9px] text-slate-400 uppercase tracking-[0.22em]">
                        SUMMARY
                      </p>
                      <p className="text-[10px] text-slate-300">
                        Current strongest variant:&nbsp;
                        <span className="font-semibold text-amber-200">
                          {agentData.suggestedVariant.fromVariant}
                        </span>
                      </p>
                      {agentData.suggestedVariant.meta.basedOn && (
                        <p className="mt-1 text-[10px] text-slate-400">
                          Based on avg scroll&nbsp;
                          <span className="text-amber-200">
                            {agentData.suggestedVariant.meta.basedOn.avgScroll?.toFixed(
                              1
                            ) ?? "—"}
                            %
                          </span>
                          &nbsp;and&nbsp;
                          <span className="text-rose-200">
                            {agentData.suggestedVariant.meta.basedOn.clicks}
                          </span>{" "}
                          clicks.
                        </p>
                      )}
                    </div>

                    <div className="rounded border border-slate-700 bg-slate-950/70 px-3 py-3">
                      <p className="mb-1 text-[9px] text-slate-400 uppercase tracking-[0.22em]">
                        PROPOSED BUILD C
                      </p>
                      <p className="text-xs font-semibold text-slate-50">
                        {agentData.suggestedVariant.heroTitle}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-300">
                        {agentData.suggestedVariant.heroSubtitle}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                        <span className="rounded-full border border-lime-400/60 px-2 py-1 text-lime-300">
                          {agentData.suggestedVariant.primaryCta}
                        </span>
                        <span className="rounded-full border border-slate-600 px-2 py-1 text-slate-200">
                          {agentData.suggestedVariant.secondaryCta}
                        </span>
                        <span className="rounded-full border border-amber-500/60 px-2 py-1 text-amber-300">
                          {agentData.suggestedVariant.badge}
                        </span>
                      </div>
                      <p className="mt-2 text-[10px] text-slate-400">
                        {agentData.suggestedVariant.meta.explanation}
                      </p>
                    </div>
                  </div>
                )}

                {!agentData && !agentLoading && !agentError && (
                  <p className="mt-2 text-[10px] text-slate-400">
                    Click <span className="text-lime-300">RUN AGENT</span> to
                    analyze current A/B performance and propose the next hero
                    variant (Build C).
                  </p>
                )}
              </div>
            </section>

            {/* Recent events table */}
            <section>
              <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                LIVE EVENT LOG
              </h2>
              <div className="retro-panel scanline-overlay border border-slate-700/80 p-3">
                <div className="mb-2 flex items-center justify-between text-[9px] text-slate-400">
                  <span>/firestore/events</span>
                  <span className="hud-scan text-lime-300">
                    STREAM • REFRESHING EVERY 5s
                  </span>
                </div>
                <div className="overflow-auto rounded-md border border-slate-800 bg-black/60">
                  <table className="w-full text-left text-[10px]">
                    <thead className="bg-slate-900/80 text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Time</th>
                        <th className="px-3 py-2">Session</th>
                        <th className="px-3 py-2">Variant</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((e, idx) => (
                        <tr
                          key={`${e.ts}-${idx}`}
                          className="border-t border-slate-800/80"
                        >
                          <td className="px-3 py-2 text-slate-300">
                            {new Date(e.ts).toLocaleTimeString()}
                          </td>
                          <td className="px-3 py-2 text-slate-400">
                            {e.sessionId.slice(0, 8)}…
                          </td>
                          <td className="px-3 py-2 text-slate-300">
                            {e.variantId ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={[
                                "rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wide",
                                e.eventType === "click"
                                  ? "bg-rose-500/20 text-rose-200"
                                  : e.eventType === "scroll"
                                  ? "bg-amber-500/20 text-amber-200"
                                  : "bg-slate-700/50 text-slate-100"
                              ].join(" ")}
                            >
                              {e.eventType}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-300">
                            {e.eventType === "scroll" &&
                              `Scroll: ${e.payload.scrollPercent}%`}
                            {e.eventType === "click" &&
                              `Click on ${e.payload.tag} "${
                                (e.payload.text as string) || ""
                              }"`}
                            {e.eventType === "pageview" &&
                              `Path: ${e.payload.path}`}
                          </td>
                        </tr>
                      ))}
                      {events.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-3 py-4 text-center text-slate-400"
                          >
                            No events yet. Open the main page, scroll and click
                            to generate telemetry.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
