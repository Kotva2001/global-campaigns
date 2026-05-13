import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { clearAuthRedirectFromUrl, isForbiddenAuthError } from "@/lib/authRedirect";
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
  const [submitting, setSubmitting] = useState(false);

  const handleGoogle = async () => {
    setSubmitting(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      if (isForbiddenAuthError(result.error)) {
        await supabase.auth.signOut();
        clearAuthRedirectFromUrl();
      }
      setSubmitting(false);
      toast({
        title: "Sign-in failed",
        description: result.error.message ?? "Could not sign in with Google.",
        variant: "destructive",
      });
      return;
    }
    if (result.redirected) return;

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      await supabase.auth.signOut();
      clearAuthRedirectFromUrl();
      setSubmitting(false);
      toast({
        title: "Sign-in failed",
        description: "The returned Google session could not be validated. Please try again.",
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
          disabled={submitting}
          className="w-full gap-3 bg-white font-semibold text-slate-900 hover:bg-white/90"
          style={{ height: 44, boxShadow: "0 0 24px rgba(0,240,255,0.18)" }}
        >
          <GoogleIcon />
          {submitting ? "Redirecting…" : "Sign in with Google"}
        </Button>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Access restricted to invited team members.
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