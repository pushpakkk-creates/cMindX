import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

export async function POST(req: Request) {
  try {
    const { autoMode } = await req.json();

    const ref = doc(db, "settings", "agent");
    await updateDoc(ref, { autoMode });

    return NextResponse.json({ ok: true, autoMode });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message },
      { status: 500 }
    );
  }
}
