"use client";

import React, { useEffect, useState } from "react";
import { useAnalytics } from "@/hooks/useAnalytics";

type VariantId = "A" | "B";

export default function Home() {
  const [variantId, setVariantId] = useState<VariantId>("A");

  useEffect(() => {
    const v: VariantId = Math.random() < 0.5 ? "A" : "B";
    setVariantId(v);
  }, []);

  useAnalytics(variantId);

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
              A landing page that rewrites itself from live behaviour.
            </h1>

            <p className="max-w-xl text-sm leading-relaxed text-neutral-300 md:text-[15px]">
              Instead of shipping static copy, cMindX watches how visitors
              scroll, click and drop off — then quietly evolves your hero,
              CTAs and above-the-fold layout based on what actually performs.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 shadow-sm hover:bg-neutral-200"
              >
                View live dashboard
              </a>
              <a
                href="#how"
                className="inline-flex items-center justify-center rounded-full border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-100 hover:border-neutral-400"
              >
                See how it works
              </a>
            </div>

            <div className="mt-6 grid gap-4 text-xs text-neutral-400 sm:grid-cols-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
                  Live traffic
                </p>
                <p className="mt-1">
                  Every scroll, click and exit is tracked with the active
                  variant ID.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
                  Analytics → agent
                </p>
                <p className="mt-1">
                  Firestore stores behaviour; the AI agent reads it to find
                  what’s actually working.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
                  New variants
                </p>
                <p className="mt-1">
                  Gemini proposes new hero variants (Build C, D, …) you can
                  approve from the dashboard.
                </p>
              </div>
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
                  {variantId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Data source</span>
                <span className="text-neutral-100">
                  Firestore events & variants
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Agent</span>
                <span className="text-neutral-100">
                  Gemini-powered evolution
                </span>
              </div>
            </div>

            <hr className="my-4 border-neutral-900" />

            <p className="text-xs text-neutral-400">
              cMindX doesn’t replace your CMS. It sits in front of your
              marketing site and handles the small but expensive question:{" "}
              <span className="text-neutral-100">
                “What should this page say right now?”
              </span>
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
              <li>• Frontend: this landing page with a lightweight hook</li>
              <li>• Storage: Firestore collections for events & variants</li>
              <li>• Agent: Gemini uses live stats to suggest Build C</li>
              <li>• Control: dashboard to see performance & approve changes</li>
            </ul>
          </div>

          <div id="what">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
              What exactly cMindX edits
            </h2>
            <div className="mt-4 grid gap-4 text-sm text-neutral-300">
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-4">
                <p className="font-medium text-neutral-100">
                  Hero headline & subcopy
                </p>
                <p className="mt-1 text-xs text-neutral-400">
                  The core promise of your product, tuned from live traffic
                  instead of guesswork.
                </p>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-4">
                <p className="font-medium text-neutral-100">
                  Primary & secondary CTAs
                </p>
                <p className="mt-1 text-xs text-neutral-400">
                  Button labels and framing based on what people actually
                  click.
                </p>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-4">
                <p className="font-medium text-neutral-100">
                  Above-the-fold structure
                </p>
                <p className="mt-1 text-xs text-neutral-400">
                  The first screen visitors see, optimised to reduce bounce.
                </p>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-4">
                <p className="font-medium text-neutral-100">
                  Variant history in Firestore
                </p>
                <p className="mt-1 text-xs text-neutral-400">
                  Every Build C, D, E stored with metadata so you can promote,
                  roll back or compare at any time.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-neutral-900 px-5 py-4 text-xs text-neutral-500 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} cMindX.</span>
          <span>Built for teams who want their website to think.</span>
        </div>
      </footer>
    </div>
  );
}
