"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  addDoc,
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
  aiUsed?: string;
  aiError?: string | null;
};

function computeVariantStats(events: AnalyticsEvent[]): VariantStats[] {
  const byVariant: Record<VariantId, AnalyticsEvent[]> = { A: [], B: [] };

  for (const e of events) {
    const v = (e.variantId as VariantId) ?? "A";
    if (v === "A" || v === "B") byVariant[v].push(e);
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
        clickEvents: 0,
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
        ? scrollPercents.reduce((a, b) => a + b, 0) / scrollPercents.length
        : null;

    const clickEvents = ve.filter((e) => e.eventType === "click").length;

    stats.push({
      variantId,
      totalEvents: ve.length,
      sessions: sessionSet.size,
      scrollEvents: scrollEvents.length,
      avgScrollPercent: avgScroll,
      clickEvents,
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

  const [savingVariant, setSavingVariant] = useState(false);
  const [savedVariantId, setSavedVariantId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Filters + pagination for Recent Events
  const [filterType, setFilterType] = useState<string>("all");
  const [filterVariant, setFilterVariant] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(0);
  const pageSize = 50;
  const maxDisplayEvents = 200; // show only last 100 on the dashboard

  async function loadEvents() {
    try {
      const q = query(
        collection(db, "events"),
        orderBy("ts", "desc"),
        limit(500) // fetch up to 500 latest events from Firestore
      );
      const snap = await getDocs(q);
      const loaded: AnalyticsEvent[] = snap.docs.map((doc) => {
        const data = doc.data() as any;
        return {
          sessionId: data.sessionId ?? "unknown",
          eventType: data.eventType ?? "unknown",
          payload: (data.payload ?? {}) as Record<string, unknown>,
          ts: data.ts ?? new Date().toISOString(),
          variantId: data.variantId,
        };
      });
      setEvents(loaded);
    } catch (e) {
      console.error("Error loading events:", e);
    } finally {
      setLoading(false);
    }
  }

  async function runAgent() {
    try {
      setAgentError(null);
      setAgentLoading(true);
      setSavedVariantId(null);
      setSaveError(null);

      const res = await fetch("/api/agent");
      const json: AgentResponse = await res.json();

      if (!res.ok || !json.ok) throw new Error("Agent returned error");
      setAgentData(json);
    } catch (err) {
      console.error(err);
      setAgentError("Agent failed to generate a suggestion.");
    } finally {
      setAgentLoading(false);
    }
  }

  async function saveSuggestedVariant() {
    if (!agentData?.suggestedVariant) return;

    try {
      setSavingVariant(true);
      setSaveError(null);
      setSavedVariantId(null);

      const s = agentData.suggestedVariant;

      const docRef = await addDoc(collection(db, "variants"), {
        heroTitle: s.heroTitle,
        heroSubtitle: s.heroSubtitle,
        primaryCta: s.primaryCta,
        secondaryCta: s.secondaryCta,
        badge: s.badge,
        status: "testing",
        createdBy: "ai",
        fromVariant: s.fromVariant,
        meta: s.meta,
        createdAt: new Date().toISOString(),
      });

      setSavedVariantId(docRef.id);
    } catch (e) {
      console.error(e);
      setSaveError("Failed to save variant.");
    } finally {
      setSavingVariant(false);
    }
  }

  useEffect(() => {
    loadEvents();
    const id = setInterval(loadEvents, 5000);
    return () => clearInterval(id);
  }, []);

  // Reset page when filters/search change
  useEffect(() => {
    setCurrentPage(0);
  }, [filterType, filterVariant, searchQuery]);

  // Global stats use all loaded events (up to 500)
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

  // ---- Recent Events: only last 100, with filters + pagination ----

  // latest first from Firestore; take only first 100
  const baseEvents = events.slice(0, maxDisplayEvents);

  const filteredEvents = baseEvents.filter((e) => {
    // Filter by type
    const typeOk =
      filterType === "all"
        ? true
        : filterType === "other"
        ? !["pageview", "click", "scroll"].includes(
            e.eventType.toLowerCase()
          )
        : e.eventType.toLowerCase() === filterType;

    // Filter by variant
    const v = (e.variantId ?? "unknown").toUpperCase();
    const variantOk =
      filterVariant === "all"
        ? true
        : filterVariant === "unknown"
        ? v !== "A" && v !== "B"
        : v === filterVariant.toUpperCase();

    // Search in payload JSON
    const payloadString = JSON.stringify(e.payload ?? {}).toLowerCase();
    const searchOk = searchQuery
      ? payloadString.includes(searchQuery.toLowerCase())
      : true;

    return typeOk && variantOk && searchOk;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredEvents.length / pageSize)
  );
  const safePage = Math.min(currentPage, totalPages - 1);
  const startIndex = safePage * pageSize;
  const pageEvents = filteredEvents.slice(
    startIndex,
    startIndex + pageSize
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="mx-auto max-w-6xl px-5 py-6 space-y-8 md:px-8">
        {/* HEADER */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-800 text-[11px] font-semibold">
              HUD
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">
                cMindX dashboard
              </p>
              <p className="text-xs text-neutral-500">
                Live behaviour & variant performance
              </p>
            </div>
          </div>

          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-neutral-700 px-3 py-1.5 text-[11px] text-neutral-100 hover:border-neutral-400"
          >
            Back to site
          </a>
        </header>

        {loading ? (
          <p className="text-sm text-neutral-300">Loading telemetry…</p>
        ) : (
          <>
            {/* METRICS ROW */}
            <section className="grid gap-4 md:grid-cols-3 text-sm">
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                  Total events
                </p>
                <p className="mt-2 text-2xl font-semibold text-neutral-50">
                  {totalEvents}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Scrolls, clicks and pageviews combined.
                </p>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                  Unique sessions
                </p>
                <p className="mt-2 text-2xl font-semibold text-neutral-50">
                  {uniqueSessions}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Distinct visitors based on sessionId.
                </p>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                  Current winner
                </p>
                <p className="mt-2 text-2xl font-semibold text-neutral-50">
                  {winner ? `Variant ${winner}` : "Not enough data"}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Determined by higher average scroll depth.
                </p>
              </div>
            </section>

            {/* VARIANT PERFORMANCE */}
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Variant performance
              </h2>
              <div className="grid gap-4 md:grid-cols-2 text-sm">
                {variantStats.map((s) => (
                  <div
                    key={s.variantId}
                    className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-4"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-neutral-50">
                        Variant {s.variantId}
                      </p>
                      {winner === s.variantId && (
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-900">
                          Leading
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[11px] text-neutral-500">
                          Sessions
                        </p>
                        <p className="text-neutral-100">{s.sessions}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-neutral-500">
                          Total events
                        </p>
                        <p className="text-neutral-100">
                          {s.totalEvents}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-neutral-500">
                          Avg scroll
                        </p>
                        <p className="text-neutral-100">
                          {s.avgScrollPercent !== null
                            ? `${s.avgScrollPercent.toFixed(1)}%`
                            : "–"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-neutral-500">
                          Click events
                        </p>
                        <p className="text-neutral-100">
                          {s.clickEvents}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* AI VARIANT LAB */}
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                AI variant lab
              </h2>
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-200">
                      Generate the next hero variant from live data
                    </p>
                    <p className="text-xs text-neutral-500">
                      The agent uses the same metrics as this dashboard to
                      propose a new Build C.
                    </p>
                  </div>
                  <button
                    onClick={runAgent}
                    disabled={agentLoading}
                    className="inline-flex items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 px-4 py-1.5 text-[11px] font-medium text-neutral-900 hover:bg-neutral-200 disabled:opacity-60"
                  >
                    {agentLoading ? "Running…" : "Run agent"}
                  </button>
                </div>

                {agentError && (
                  <p className="mt-2 text-xs text-red-400">{agentError}</p>
                )}

                {agentData && !agentError && (
                  <div className="mt-4 grid gap-4 md:grid-cols-2 text-xs">
                    {/* Summary */}
                    <div className="rounded-lg border border-neutral-800 bg-neutral-950/90 p-3">
                      <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                        Summary
                      </p>
                      <p className="text-neutral-300">
                        Based on variant{" "}
                          <span className="font-medium text-neutral-100">
                            {agentData.suggestedVariant.fromVariant}
                          </span>
                      </p>
                      {agentData.suggestedVariant.meta.basedOn && (
                        <p className="mt-1 text-neutral-400">
                          Scroll:{" "}
                          <span className="text-neutral-100">
                            {agentData.suggestedVariant.meta.basedOn.avgScroll?.toFixed(
                              1
                            ) ?? "–"}
                            %
                          </span>{" "}
                          · Clicks:{" "}
                          <span className="text-neutral-100">
                            {
                              agentData.suggestedVariant.meta.basedOn
                                .clicks
                            }
                          </span>
                        </p>
                      )}
                      <p className="mt-2 text-neutral-500">
                        Source:{" "}
                        <span className="text-neutral-200">
                          {agentData.aiUsed === "gemini"
                            ? "Gemini"
                            : "Heuristic"}
                        </span>
                      </p>
                      {agentData.aiError && (
                        <p className="mt-1 text-neutral-500">
                          {agentData.aiError}
                        </p>
                      )}
                    </div>

                    {/* Proposed variant */}
                    <div className="rounded-lg border border-neutral-800 bg-neutral-950/90 p-3">
                      <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                        Proposed variant
                      </p>
                      <p className="text-neutral-100 font-semibold">
                        {agentData.suggestedVariant.heroTitle}
                      </p>
                      <p className="mt-2 text-neutral-400">
                        {agentData.suggestedVariant.heroSubtitle}
                      </p>
                      <p className="mt-3 text-neutral-500">
                        Primary CTA:{" "}
                        <span className="text-neutral-200">
                          {agentData.suggestedVariant.primaryCta}
                        </span>
                      </p>
                      <p className="text-neutral-500">
                        Secondary CTA:{" "}
                        <span className="text-neutral-200">
                          {agentData.suggestedVariant.secondaryCta}
                        </span>
                      </p>
                      <p className="mt-1 text-neutral-500">
                        Badge:{" "}
                        <span className="text-neutral-200">
                          {agentData.suggestedVariant.badge}
                        </span>
                      </p>
                    </div>
                  </div>
                )}

                {agentData && (
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={saveSuggestedVariant}
                      disabled={savingVariant}
                      className="inline-flex items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 px-4 py-1.5 text-[11px] font-medium text-neutral-900 hover:bg-neutral-200 disabled:opacity-60"
                    >
                      {savingVariant ? "Saving…" : "Save as variant"}
                    </button>
                  </div>
                )}

                {savedVariantId && (
                  <p className="mt-2 text-xs text-green-400">
                    Saved! Variant ID: {savedVariantId}
                  </p>
                )}
                {saveError && (
                  <p className="mt-2 text-xs text-red-400">{saveError}</p>
                )}
              </div>
            </section>

            {/* RECENT EVENTS WITH FILTERS + PAGINATION */}
            <section className="mb-10 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  Recent events (latest {maxDisplayEvents})
                </h2>
                <div className="flex flex-wrap gap-2 text-xs">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-200"
                  >
                    <option value="all">All types</option>
                    <option value="pageview">Pageview</option>
                    <option value="click">Click</option>
                    <option value="scroll">Scroll</option>
                    <option value="other">Other</option>
                  </select>

                  <select
                    value={filterVariant}
                    onChange={(e) => setFilterVariant(e.target.value)}
                    className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-200"
                  >
                    <option value="all">All variants</option>
                    <option value="A">Variant A</option>
                    <option value="B">Variant B</option>
                    <option value="unknown">Unknown</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Search payload…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-200"
                  />
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-950/80">
                <table className="min-w-full text-left text-xs text-neutral-300">
                  <thead className="border-b border-neutral-800 bg-neutral-900">
                    <tr>
                      <th className="px-4 py-2">Time</th>
                      <th className="px-4 py-2">Type</th>
                      <th className="px-4 py-2">Variant</th>
                      <th className="px-4 py-2">Payload</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageEvents.map((e, i) => (
                      <tr
                        key={i}
                        className="border-b border-neutral-900 hover:bg-neutral-900/50"
                      >
                        <td className="px-4 py-2 text-neutral-400">
                          {new Date(e.ts).toLocaleString()}
                        </td>
                        <td className="px-4 py-2">{e.eventType}</td>
                        <td className="px-4 py-2">{e.variantId ?? "—"}</td>
                        <td className="px-4 py-2 text-neutral-400">
                          {JSON.stringify(e.payload)}
                        </td>
                      </tr>
                    ))}
                    {pageEvents.length === 0 && (
                      <tr>
                        <td
                          className="px-4 py-4 text-center text-neutral-500"
                          colSpan={4}
                        >
                          No events matching current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>
                  Showing{" "}
                  <span className="text-neutral-200">
                    {pageEvents.length}
                  </span>{" "}
                  of{" "}
                  <span className="text-neutral-200">
                    {filteredEvents.length}
                  </span>{" "}
                  filtered events
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.max(0, p - 1))
                    }
                    disabled={safePage === 0}
                    className="rounded-full border border-neutral-700 px-2 py-1 text-[11px] text-neutral-200 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span>
                    Page{" "}
                    <span className="text-neutral-200">
                      {safePage + 1}
                    </span>{" "}
                    /{" "}
                    <span className="text-neutral-200">
                      {totalPages}
                    </span>
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((p) =>
                        Math.min(totalPages - 1, p + 1)
                      )
                    }
                    disabled={safePage >= totalPages - 1}
                    className="rounded-full border border-neutral-700 px-2 py-1 text-[11px] text-neutral-200 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
