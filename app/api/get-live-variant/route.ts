import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function GET() {
  try {
    const ref = doc(db, "settings", "liveVariant");
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return NextResponse.json({ ok: true, variant: null });
    }

    return NextResponse.json({ ok: true, variant: snap.data() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
