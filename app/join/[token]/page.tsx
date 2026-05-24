"use client";

import * as React from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

import { useUser } from "@/lib/auth/AuthProvider";
import { getInvite, isInviteExpired } from "@/lib/db/invites";
import { addMemberSelf } from "@/lib/db/teamMembers";
import { getDb } from "@/lib/firebase/client";
import { doc, getDoc } from "firebase/firestore";
import type { Invite, Team } from "@/lib/types";
import { Button } from "@/components/ui/button";

type State =
  | { kind: "loading" }
  | { kind: "invalid"; reason: string }
  | { kind: "ready"; invite: Invite; team: Team }
  | { kind: "joining"; invite: Invite; team: Team }
  | { kind: "joined" };

export default function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const { user, userDoc, loading: authLoading } = useUser();
  const [state, setState] = React.useState<State>({ kind: "loading" });

  // Phase 1: gate on auth. If not signed in, bounce to /signin?returnTo=...
  // We don't touch state here — router.replace unmounts us, and the spinner
  // shown in the meantime is the same one as `kind: "loading"`.
  React.useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/signin?returnTo=${encodeURIComponent(`/join/${token}`)}`);
    }
  }, [authLoading, user, token, router]);

  // Phase 2: once authed, resolve the invite + team. Idempotent — if the
  // user is already a member, fall straight through to /.
  React.useEffect(() => {
    if (authLoading || !user || !userDoc) return;
    let cancelled = false;
    (async () => {
      try {
        const invite = await getInvite(token);
        if (cancelled) return;
        if (!invite) {
          setState({ kind: "invalid", reason: "This invite link is invalid or has been revoked." });
          return;
        }
        if (userDoc.teams.some((t) => t.teamId === invite.teamId)) {
          // Already a member — skip the join step.
          setState({ kind: "joined" });
          toast.info("You're already in this team.");
          router.replace("/");
          return;
        }
        if (isInviteExpired(invite)) {
          setState({ kind: "invalid", reason: "expired" });
          return;
        }
        const teamSnap = await getDoc(doc(getDb(), "teams", invite.teamId));
        if (!teamSnap.exists()) {
          setState({ kind: "invalid", reason: "The team for this invite no longer exists." });
          return;
        }
        setState({ kind: "ready", invite, team: teamSnap.data() as Team });
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setState({ kind: "invalid", reason: (err as Error).message ?? "Failed to load invite." });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, userDoc, token, router]);

  const join = async () => {
    if (state.kind !== "ready" || !userDoc) return;
    const { invite, team } = state;
    setState({ kind: "joining", invite, team });
    try {
      await addMemberSelf(invite.teamId, userDoc);
      toast.success(`Joined ${team.name}.`);
      setState({ kind: "joined" });
      router.replace("/");
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message ?? "Couldn't join the team.");
      setState({ kind: "ready", invite, team });
    }
  };

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      {state.kind === "loading" || state.kind === "joined" ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      ) : state.kind === "invalid" ? (
        <Card
          icon={<AlertCircle className="size-8 text-destructive" />}
          title={state.reason === "expired" ? "Invite link expired" : "Invite link invalid"}
        >
          <p className="text-sm text-muted-foreground">
            {state.reason === "expired"
              ? "This invite link has expired. Ask the team owner for a new one."
              : state.reason}
          </p>
          <Button onClick={() => router.replace("/")} className="mt-2">Go home</Button>
        </Card>
      ) : (
        <Card
          icon={
            <span
              aria-hidden
              className="flex size-8 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: state.team.color }}
            >
              <Users className="size-4" />
            </span>
          }
          title={`Join ${state.team.name}?`}
        >
          <p className="text-sm text-muted-foreground">
            You&apos;ll be added as a member of {state.team.name}.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.replace("/")} disabled={state.kind === "joining"}>
              Not now
            </Button>
            <Button onClick={join} disabled={state.kind === "joining"}>
              {state.kind === "joining" ? <Loader2 className="size-4 animate-spin" /> : null}
              <span className={state.kind === "joining" ? "ml-2" : ""}>Join {state.team.name}</span>
            </Button>
          </div>
        </Card>
      )}
    </main>
  );
}

function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg border bg-card p-6 text-center">
      {icon}
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}
