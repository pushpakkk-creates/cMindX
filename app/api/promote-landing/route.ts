import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import type { LandingPageSpec } from "../landing-agent/route";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const spec: LandingPageSpec | undefined = body.spec;

    if (!spec) {
      return NextResponse.json(
        { ok: false, error: "Missing spec" },
        { status: 400 }
      );
    }

    const slug: string =
      body.slug ||
      `landing-build-${Math.floor(Date.now() / 1000).toString()}`;

    // Save full spec under /landingPages/{slug}
    await setDoc(doc(db, "landingPages", slug), {
      slug,
      spec,
      createdAt: new Date().toISOString(),
      source: body.source || "agent",
    });

    // Also mark as active under /settings/landingPage
    await setDoc(doc(db, "settings", "landingPage"), {
      slug,
      spec,
      promotedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, slug });
  } catch (e: any) {
    console.error("promote-landing error:", e);
    return NextResponse.json(
      { ok: false, error: e.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
