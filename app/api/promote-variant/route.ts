import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";

type VariantPayload = {
  heroTitle: string;
  heroSubtitle: string;
  primaryCta: string;
  secondaryCta: string;
  badge?: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const variant: VariantPayload | undefined = body.variant;
    const variantId: string =
      body.variantId || `live-${Date.now().toString()}`;

    // Basic validation
    if (
      !variant ||
      !variant.heroTitle ||
      !variant.heroSubtitle ||
      !variant.primaryCta ||
      !variant.secondaryCta
    ) {
      return NextResponse.json(
        { ok: false, error: "Invalid variant payload" },
        { status: 400 }
      );
    }

    const ref = doc(db, "settings", "liveVariant");

    await setDoc(ref, {
      variantId,
      heroTitle: variant.heroTitle,
      heroSubtitle: variant.heroSubtitle,
      primaryCta: variant.primaryCta,
      secondaryCta: variant.secondaryCta,
      badge: variant.badge ?? "AI Variant",
      promotedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, variantId });
  } catch (e: any) {
    console.error("promote-variant error:", e);
    return NextResponse.json(
      { ok: false, error: e.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
