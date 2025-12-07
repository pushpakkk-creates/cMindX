"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

type LandingSection =
  | {
      type: "section";
      title: string;
      body: string;
    }
  | {
      type: "bullets";
      title: string;
      items: string[];
    }
  | {
      type: "cta";
      title: string;
      body: string;
    };

type LandingPageDoc = {
  slug: string;
  name: string;
  pageTitle: string;
  heroTitle: string;
  heroSubtitle: string;
  primaryCta: string;
  secondaryCta: string;
  sections: LandingSection[];
  createdAt?: string;
};

export default function BuildPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [page, setPage] = useState<LandingPageDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        setNotFound(false);

        const ref = doc(db, "landingPages", slug);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setNotFound(true);
          setPage(null);
        } else {
          setPage(snap.data() as LandingPageDoc);
        }
      } catch (e) {
        console.error(e);
        setError("Failed to load landing page.");
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      load();
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-50 flex items-center justify-center">
        <p className="text-sm text-neutral-400">Loading build…</p>
      </div>
    );
  }

  if (notFound || !page) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-50 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-sm text-neutral-300">Build not found.</p>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full border border-neutral-700 px-3 py-1.5 text-xs text-neutral-100 hover:border-neutral-400"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      {/* HEADER */}
      <header className="border-b border-neutral-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-100 text-[11px] font-semibold text-neutral-900">
              cX
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight">
                cMindX · Build
              </span>
              <span className="text-[11px] text-neutral-500">
                {page.name}
              </span>
            </div>
          </div>

          <nav className="hidden items-center gap-4 text-xs text-neutral-400 md:flex">
            <a href="/" className="hover:text-neutral-100">
              Main page
            </a>
            <a href="/dashboard" className="hover:text-neutral-100">
              Dashboard
            </a>
          </nav>
        </div>
      </header>

      {/* MAIN */}
      <main className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-16 space-y-12">
        {/* HERO */}
        <section className="space-y-5 max-w-3xl">
          <p className="text-[11px] uppercase tracking-[0.22em] text-neutral-500">
            Experimental build • {page.name}
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold leading-tight tracking-tight">
            {page.heroTitle}
          </h1>
          <p className="text-sm md:text-[15px] text-neutral-300 leading-relaxed">
            {page.heroSubtitle}
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-200"
            >
              {page.primaryCta}
            </a>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-100 hover:border-neutral-400"
            >
              {page.secondaryCta}
            </a>
          </div>
        </section>

        {/* SECTIONS */}
        <section className="space-y-6">
          {page.sections?.map((section, idx) => {
            if (section.type === "section") {
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5"
                >
                  <h2 className="text-sm font-semibold text-neutral-50">
                    {section.title}
                  </h2>
                  <p className="mt-2 text-xs md:text-sm text-neutral-300 leading-relaxed">
                    {section.body}
                  </p>
                </div>
              );
            }

            if (section.type === "bullets") {
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5"
                >
                  <h2 className="text-sm font-semibold text-neutral-50">
                    {section.title}
                  </h2>
                  <ul className="mt-2 space-y-1 text-xs md:text-sm text-neutral-300">
                    {section.items.map((item, i) => (
                      <li key={i}>• {item}</li>
                    ))}
                  </ul>
                </div>
              );
            }

            if (section.type === "cta") {
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-neutral-700 bg-neutral-50 text-neutral-900 p-5"
                >
                  <h2 className="text-sm font-semibold">{section.title}</h2>
                  <p className="mt-2 text-xs md:text-sm text-neutral-700">
                    {section.body}
                  </p>
                </div>
              );
            }

            return null;
          })}
        </section>

        {error && (
          <p className="text-xs text-red-400">
            {error}
          </p>
        )}
      </main>

      <footer className="border-t border-neutral-900 px-5 py-4 text-xs text-neutral-500 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} cMindX.</span>
          <span>Landing build generated from live behaviour.</span>
        </div>
      </footer>
    </div>
  );
}
