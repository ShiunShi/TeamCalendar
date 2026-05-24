"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  type AuthError,
} from "firebase/auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { getAuthClient } from "@/lib/firebase/client";
import { useUser } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "signin" | "signup";

// useSearchParams forces dynamic rendering; wrap the page in Suspense so the
// build doesn't choke when statically analyzing the route.
export default function SignInPage() {
  return (
    <React.Suspense fallback={null}>
      <SignInInner />
    </React.Suspense>
  );
}

function SignInInner() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get("returnTo") ?? "/";
  const { user, loading: authLoading } = useUser();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [mode, setMode] = React.useState<Mode>("signin");
  const [busy, setBusy] = React.useState<Mode | "google" | null>(null);

  // Already signed in → bounce to wherever the user was headed.
  React.useEffect(() => {
    if (!authLoading && user) router.replace(returnTo);
  }, [authLoading, user, router, returnTo]);

  const explain = (err: unknown): string => {
    const code = (err as AuthError)?.code ?? "";
    switch (code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Email or password is incorrect.";
      case "auth/email-already-in-use":
        return "An account with that email already exists. Try signing in.";
      case "auth/weak-password":
        return "Password must be at least 6 characters.";
      case "auth/invalid-email":
        return "That email address looks invalid.";
      case "auth/popup-closed-by-user":
        return "Sign-in window was closed before completing.";
      case "auth/configuration-not-found":
      case "auth/operation-not-allowed":
        return "This sign-in method isn't enabled in the Firebase project.";
      default:
        return (err as Error)?.message ?? "Sign-in failed.";
    }
  };

  const handleGoogle = async () => {
    setBusy("google");
    try {
      await signInWithPopup(getAuthClient(), new GoogleAuthProvider());
      router.replace(returnTo);
    } catch (err) {
      toast.error(explain(err));
    } finally {
      setBusy(null);
    }
  };

  const handleEmail = async (m: Mode) => {
    if (!email || !password) {
      toast.error("Email and password are required.");
      return;
    }
    setBusy(m);
    try {
      if (m === "signin") {
        await signInWithEmailAndPassword(getAuthClient(), email, password);
      } else {
        await createUserWithEmailAndPassword(getAuthClient(), email, password);
      }
      router.replace(returnTo);
    } catch (err) {
      toast.error(explain(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="flex min-h-screen w-full">
      <MarketingPanel />
      <FormPanel
        mode={mode}
        setMode={setMode}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        busy={busy}
        onGoogle={handleGoogle}
        onEmail={handleEmail}
      />
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Left pane — branded marketing. Hidden below md (mobile shows only the form).
// ─────────────────────────────────────────────────────────────────────────────
function MarketingPanel() {
  return (
    <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-500 via-indigo-700 to-indigo-900 p-12 text-white md:flex md:w-1/2">
      {/* Subtle grid overlay — soft 80px lines that fade toward the edges so
          the gradient still reads as the dominant surface. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18] [mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_100%)]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.18) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      <header className="relative z-10 flex items-center gap-2">
        <Wordmark />
      </header>

      <div className="relative z-10 max-w-2xl space-y-5">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/20 backdrop-blur">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          New · cross-team visibility
        </span>
        <h1 className="whitespace-nowrap text-7xl font-semibold leading-[1.05] tracking-tight">
          One calendar for
          <br />
          the whole <span className="text-white/40">team.</span>
        </h1>
        <p className="max-w-md text-xl text-white/80">
          See who&apos;s out, who&apos;s traveling, and what&apos;s shipping —
          across every team, in one beautifully simple month view.
        </p>
        <div className="flex items-center gap-3">
          <AvatarStack />
          <span className="text-xs text-white/70">
            20 people · 5 teams · synced in real time
          </span>
        </div>
      </div>
    </aside>
  );
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
        <DotClusterMark className="size-5" />
      </span>
      <span className="text-lg font-semibold tracking-tight">TeamCalendar</span>
    </div>
  );
}

// Four outer dots + a slightly smaller center dot — reads as "team connected
// around one calendar" at small sizes.
function DotClusterMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="4.5" r="1.6" />
      <circle cx="12" cy="19.5" r="1.6" />
      <circle cx="4.5" cy="12" r="1.6" />
      <circle cx="19.5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.2" />
    </svg>
  );
}

function AvatarStack() {
  const items: Array<{ initials: string; color: string }> = [
    { initials: "AR", color: "#3B82F6" },
    { initials: "SM", color: "#A855F7" },
    { initials: "EV", color: "#22C55E" },
    { initials: "IL", color: "#14B8A6" },
    { initials: "VP", color: "#F97316" },
  ];
  return (
    <div className="flex -space-x-2">
      {items.map((a) => (
        <span
          key={a.initials}
          aria-hidden
          className="flex size-7 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-indigo-700"
          style={{ backgroundColor: a.color }}
        >
          {a.initials}
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Right pane — form. Always rendered. On mobile, surfaces the wordmark at top.
// ─────────────────────────────────────────────────────────────────────────────
function FormPanel({
  mode,
  setMode,
  email,
  setEmail,
  password,
  setPassword,
  busy,
  onGoogle,
  onEmail,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  busy: Mode | "google" | null;
  onGoogle: () => void;
  onEmail: (m: Mode) => void;
}) {
  const isSignin = mode === "signin";
  return (
    <section className="flex flex-1 flex-col items-center justify-center px-6 py-10 md:px-12">
      <div className="mb-8 flex w-full max-w-sm items-center justify-start md:hidden">
        <MobileWordmark />
      </div>

      <div className="w-full max-w-sm space-y-6">
        <header className="space-y-1.5">
          <h2 className="text-3xl font-semibold tracking-tight">
            {isSignin ? "Welcome back" : "Create your account"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isSignin
              ? "Sign in to see your team's plans for the week."
              : "Get your team on the same calendar in under a minute."}
          </p>
        </header>

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          onClick={onGoogle}
          disabled={busy !== null}
        >
          {busy === "google" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <GoogleMark />
          )}
          <span className="ml-2">Continue with Google</span>
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onEmail(mode);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy !== null}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={isSignin ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy !== null}
              required
              minLength={6}
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={busy !== null}
          >
            {busy === mode ? <Loader2 className="size-4 animate-spin" /> : null}
            <span className={busy === mode ? "ml-2" : ""}>
              {isSignin ? "Sign in with email" : "Create account"}
            </span>
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          By continuing, you agree to our{" "}
          <a href="/terms" className="underline underline-offset-2">
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" className="underline underline-offset-2">
            Privacy Policy
          </a>
          .
        </p>

        <p className="text-center text-sm text-muted-foreground">
          {isSignin ? (
            <>
              New here?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>

      <footer className="mt-12 text-xs text-muted-foreground">
        TeamCalendar · v2.4
      </footer>
    </section>
  );
}

function MobileWordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
        <DotClusterMark className="size-4" />
      </span>
      <span className="text-lg font-semibold tracking-tight">TeamCalendar</span>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg className="size-4" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.5 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.8 6.5 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.3-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.8 6.5 29.1 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 43.5c5 0 9.7-1.9 13.2-5l-6.1-5.2c-2 1.5-4.5 2.4-7.1 2.4-5.3 0-9.7-3-11.3-7.5l-6.5 5C9.6 39 16.2 43.5 24 43.5z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.4l6.1 5.2C40.7 35.8 43.5 30.3 43.5 24c0-1.2-.1-2.3-.3-3.5z"
      />
    </svg>
  );
}
