import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { LandingPageSpec } from "../landing-agent/route";

export async function GET() {
  try {
    const snap = await getDoc(doc(db, "settings", "landingPage"));

    if (!snap.exists()) {
      return NextResponse.json({
        ok: true,
        spec: null,
        message: "No landing page spec set",
      });
    }

    const data = snap.data() as {
      slug: string;
      spec: LandingPageSpec;
    };

    return NextResponse.json({
      ok: true,
      slug: data.slug,
      spec: data.spec,
    });
  } catch (e: any) {
    console.error("active-landing error:", e);
    return NextResponse.json(
      { ok: false, error: e.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
