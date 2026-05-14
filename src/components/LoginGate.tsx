import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { UserRoleProvider, useUserRole } from "@/hooks/useUserRole";

interface Props {
  children: React.ReactNode;
}

const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 0-24c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.3-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5A20 20 0 0 0 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C40.7 36.5 44 30.8 44 24c0-1.2-.1-2.3-.4-3.5z"/>
  </svg>
);

const SignInScreen = () => {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setGoogleLoading(false);
      toast({
        title: "Sign-in failed",
        description: result.error.message ?? "Could not sign in with Google.",
        variant: "destructive",
      });
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setEmailLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setEmailLoading(false);
    if (error) {
      toast({
        title: "Sign-in failed",
        description: "Invalid email or password",
        variant: "destructive",
      });
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{ background: "#06061a" }}
    >
      {/* Synthwave nebula */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 30%, rgba(180,77,255,0.18), rgba(255,45,149,0.10) 40%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 30px)",
        }}
      />
      <Card
        className="relative w-full max-w-sm border-border p-8"
        style={{ background: "rgba(10,10,30,0.85)", backdropFilter: "blur(8px)" }}
      >
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="relative flex h-3 w-3">
            <span className="absolute inset-0 animate-ping rounded-full bg-cyan-400 opacity-75" />
            <span
              className="relative h-3 w-3 rounded-full"
              style={{ background: "#00f0ff", boxShadow: "0 0 12px #00f0ff" }}
            />
          </span>
          <h1
            className="text-xl font-extrabold tracking-tight"
            style={{
              background: "linear-gradient(90deg, #00f0ff, #ff2d95)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Influencer ROI Tracker
          </h1>
          <p
            className="text-xs font-medium"
            style={{ color: "#00f0ff", textShadow: "0 0 6px rgba(0,240,255,0.6)" }}
          >
            regals.cz
          </p>
        </div>

        <Button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading || emailLoading}
          className="w-full gap-3 bg-white font-semibold text-slate-900 hover:bg-white/90"
          style={{ height: 44, boxShadow: "0 0 24px rgba(0,240,255,0.18)" }}
        >
          <GoogleIcon />
          {googleLoading ? "Redirecting…" : "Sign in with Google"}
        </Button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, rgba(0,240,255,0.3))" }} />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">or sign in with email</span>
          <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, rgba(255,45,149,0.3), transparent)" }} />
        </div>

        <form onSubmit={handleEmailSignIn} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@regals.cz"
              className="bg-background/40"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-background/40"
            />
          </div>
          <Button
            type="submit"
            disabled={emailLoading || googleLoading || !email || !password}
            className="w-full font-semibold"
            style={{
              height: 42,
              background: "linear-gradient(90deg, #00f0ff, #ff2d95)",
              color: "#06061a",
              boxShadow: "0 0 18px rgba(255,45,149,0.35)",
            }}
          >
            {emailLoading ? "Signing in…" : "Sign In"}
          </Button>
        </form>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Access restricted to invited team members. Contact an admin for an account.
        </p>
      </Card>
    </div>
  );
};

const RoleGate = ({ children }: Props) => {
  const { user, loading } = useUserRole();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Skeleton className="h-64 w-full max-w-sm bg-card" />
      </div>
    );
  }

  if (!user) return <SignInScreen />;

  return <>{children}</>;
};

export const LoginGate = ({ children }: Props) => (
  <UserRoleProvider>
    <RoleGate>{children}</RoleGate>
  </UserRoleProvider>
);