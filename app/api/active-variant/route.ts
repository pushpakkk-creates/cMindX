import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, limit, getDocs } from "firebase/firestore";

export async function GET() {
  try {
    // Fetch `live` variant
    const q = query(
      collection(db, "variants"),
      where("status", "==", "live"),
      limit(1)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      return NextResponse.json({
        ok: true,
        variant: null,
        message: "No live variant set",
      });
    }

    const doc = snap.docs[0];
    return NextResponse.json({
      ok: true,
      id: doc.id,
      variant: doc.data(),
    });
  } catch (e: any) {
    console.error("active-variant error:", e);
    return NextResponse.json(
      { ok: false, error: e.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
