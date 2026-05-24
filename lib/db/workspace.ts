import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { getDb, WORKSPACE_ID } from "@/lib/firebase/client";

// Auto-create the single shared workspace doc on first sign-in.
// Transaction-guarded so two parallel first-sign-ins don't race.
export async function ensureDefaultWorkspace(): Promise<void> {
  const db = getDb();
  const ref = doc(db, "workspaces", WORKSPACE_ID);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) return;
    tx.set(ref, {
      workspaceId: WORKSPACE_ID,
      name: "TeamCalendar",
      createdAt: serverTimestamp(),
    });
  });
}
