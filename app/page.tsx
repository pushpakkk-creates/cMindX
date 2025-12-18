"use client";

import React, { useEffect, useState } from "react";
import { useAnalytics } from "@/hooks/useAnalytics";

type VariantId = "A" | "B";

type LandingPageSpec = {
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

// fallback spec = your current copy, used if no AI spec yet
const DEFAULT_SPEC: LandingPageSpec = {
  hero: {
    title: "A landing page that rewrites itself from live behaviour.",
    subtitle:
      "Instead of shipping static copy, cMindX watches how visitors scroll, click and drop off — then quietly evolves your hero, CTAs and above-the-fold layout based on what actually performs.",
    primaryCta: "View live dashboard",
    secondaryCta: "See how it works",
    badge: "Self-evolving website agent",
    strip: "Experiment-first landing • A/B variants with live telemetry",
  },
  system: {
    currentVariantLabel: "Variant A",
    dataSourceLabel: "Firestore events & variants",
    agentLabel: "Gemini-powered evolution",
    description:
      "cMindX doesn’t replace your CMS. It sits in front of your marketing site and handles the small but expensive question: “What should this page say right now?”",
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
    "Agent: Gemini uses live stats to suggest Build C.",
    "Control: dashboard to see performance, approve variants or enable auto-mode.",
  ],
  editCards: [
    {
      title: "Hero headline & subcopy",
      body: "The core promise of your product, tuned from real traffic instead of guesswork.",
    },
    {
      title: "Primary & secondary CTAs",
      body: "Button labels and framing based on what people actually click.",
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

export default function Home() {

  const [landingContent, setLandingContent] = useState<any>(null);

  const [variantId, setVariantId] = useState<VariantId>("A");
  const [spec, setSpec] = useState<LandingPageSpec | null>(null);
  const [usingAiSpec, setUsingAiSpec] = useState(false);

  const [usingAiLanding, setUsingAiLanding] = useState(false);
  const [activeLandingSlug, setActiveLandingSlug] = useState<string | null>(null);

  // A/B assignment for analytics
  useEffect(() => {
    const v: VariantId = Math.random() < 0.5 ? "A" : "B";
    setVariantId(v);
  }, []);

  useAnalytics(variantId);

  // Fetch active landing spec
useEffect(() => {
  async function loadLanding() {
    try {
      const res = await fetch("/api/active-landing");
      const json = await res.json();

      if (json.ok && json.spec) {
        setUsingAiLanding(true);
        setActiveLandingSlug(json.slug);
        setLandingContent(json.spec); // <-- NEW: store AI hero content
      }
    } catch (e) {
      console.error("active landing load failed", e);
    }
  }

  loadLanding();
}, []);

  const page = spec ?? DEFAULT_SPEC;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      {/* NAVBAR */}
      <header className="border-b border-neutral-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-100 text-[11px] font-semibold text-neutral-900">
              cX
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight">
                cMindX
              </span>
              <span className="text-[11px] text-neutral-500">
                Self-evolving website agent · Variant {variantId}
                {usingAiSpec && " · Live AI page"}
              </span>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-xs text-neutral-400 md:flex">
            <a href="#how" className="hover:text-neutral-100">
              How it works
            </a>
            <a href="#what" className="hover:text-neutral-100">
              What it changes
            </a>
            <a
              href="/dashboard"
              className="rounded-full border border-neutral-700 px-3 py-1.5 text-[11px] font-medium text-neutral-100 hover:border-neutral-300"
            >
              Dashboard
            </a>
          </nav>
        </div>

        {usingAiLanding && (
  <div className="border-b border-emerald-600/40 bg-emerald-900/20">
    <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-2 text-[11px] text-emerald-200 md:px-8">
      <span className="font-medium tracking-[0.16em] uppercase">
        AI Landing Build Active
      </span>
      <span className="text-emerald-300/90">
        {activeLandingSlug
          ? `Now serving: ${activeLandingSlug}`
          : "Now serving: Build C"}
      </span>
    </div>
  </div>
)}

      </header>

      {/* MAIN */}
      <main className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-16 space-y-16">
        {/* HERO */}
        <section className="grid gap-10 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-center">
          {/* Left: copy */}
          <div className="space-y-6">
            <p className="text-[11px] uppercase tracking-[0.22em] text-neutral-500">
              AI FOR WEB · CMINDX
            </p>

            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-neutral-50 md:text-5xl">
  {landingContent?.heroTitle || 
    "A landing page that rewrites itself from live behaviour."}
</h1>


            <p className="max-w-xl text-sm leading-relaxed text-neutral-300 md:text-[15px]">
              {page.hero.subtitle}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 shadow-sm hover:bg-neutral-200"
              >
                {page.hero.primaryCta}
              </a>
              <a
                href="#how"
                className="inline-flex items-center justify-center rounded-full border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-100 hover:border-neutral-400"
              >
                {page.hero.secondaryCta}
              </a>
            </div>

            <div className="mt-4 text-[11px] text-neutral-400">
              {page.hero.strip}
            </div>

            <div className="mt-6 grid gap-4 text-xs text-neutral-400 sm:grid-cols-3">
              {page.pillars.map((pillar) => (
                <div key={pillar.label}>
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
                    {pillar.label}
                  </p>
                  <p className="mt-1 text-neutral-100">{pillar.title}</p>
                  <p className="mt-1">{pillar.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: system card */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5 md:p-6">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                System overview
              </p>
              <span className="text-[11px] text-neutral-500">
                Running on this page
              </span>
            </div>

            <div className="mt-4 space-y-3 text-xs text-neutral-300">
              <div className="flex justify-between">
                <span className="text-neutral-400">Current variant</span>
                <span className="font-medium text-neutral-100">
                  {page.system.currentVariantLabel}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Data source</span>
                <span className="text-neutral-100">
                  {page.system.dataSourceLabel}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Agent</span>
                <span className="text-neutral-100">
                  {page.system.agentLabel}
                </span>
              </div>
            </div>

            <hr className="my-4 border-neutral-900" />

            <p className="text-xs text-neutral-400">
              {page.system.description}
            </p>

            <a
              href="/dashboard"
              className="mt-4 inline-flex items-center justify-center rounded-lg border border-neutral-700 px-3 py-2 text-xs font-medium text-neutral-100 hover:border-neutral-400"
            >
              Open analytics dashboard
            </a>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section
          id="how"
          className="grid gap-10 border-t border-neutral-900 pt-10 md:grid-cols-2"
        >
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
              How cMindX fits into your stack
            </h2>
            <p className="mt-4 text-sm text-neutral-300">
              You don’t rebuild your website. You give it one intelligent
              entry point: this page, a tiny analytics hook and a dashboard.
              Everything else — events, variants, agent decisions — is just
              data.
            </p>
            <ul className="mt-4 space-y-2 text-xs text-neutral-400">
              {page.stackPoints.map((point) => (
                <li key={point}>• {point}</li>
              ))}
            </ul>
          </div>

          <div id="what">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
              What exactly cMindX edits
            </h2>
            <div className="mt-4 grid gap-4 text-sm text-neutral-300">
              {page.editCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-4"
                >
                  <p className="font-medium text-neutral-100">
                    {card.title}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {card.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-neutral-900 px-5 py-4 text-xs text-neutral-500 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} cMindX.</span>
          <span>
            Built for teams who want their website to think for itself.
          </span>
        </div>
      </footer>
    </div>
  );
}
