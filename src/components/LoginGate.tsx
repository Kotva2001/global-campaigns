import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UserRoleProvider, useUserRole } from "@/hooks/useUserRole";

const GOOGLE_CLIENT_ID =
  "95933012598-tm1jm164g1nom1nhvbpp8l3rigilome2.apps.googleusercontent.com";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          renderButton: (
            el: HTMLElement,
            options: Record<string, unknown>,
          ) => void;
          prompt: () => void;
          cancel: () => void;
        };
      };
    };
  }
}

interface Props {
  children: React.ReactNode;
}

const SignInScreen = () => {
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const handleCredential = async (response: { credential: string }) => {
      setSigningIn(true);
      try {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: response.credential,
        });
        if (error) {
          console.error("[Auth] signInWithIdToken failed", error);
          toast({
            title: "Sign-in failed",
            description: error.message ?? "Could not validate Google credential.",
            variant: "destructive",
          });
          setSigningIn(false);
        }
        // onAuthStateChange in UserRoleProvider handles the rest.
      } catch (e) {
        console.error("[Auth] signInWithIdToken threw", e);
        setSigningIn(false);
      }
    };

    const init = () => {
      if (cancelled) return;
      const g = window.google;
      if (!g?.accounts?.id || !buttonRef.current) {
        if (attempts++ < 100) {
          setTimeout(init, 100);
        }
        return;
      }
      g.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential,
        auto_select: false,
      });
      g.accounts.id.renderButton(buttonRef.current, {
        theme: "filled_black",
        size: "large",
        width: 300,
        shape: "pill",
        text: "signin_with",
        logo_alignment: "center",
      });
      setReady(true);
    };

    init();
    return () => {
      cancelled = true;
      window.google?.accounts?.id?.cancel?.();
    };
  }, []);

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

        <div
          className="flex min-h-[44px] items-center justify-center"
          style={{ filter: "drop-shadow(0 0 18px rgba(0,240,255,0.35))" }}
        >
          <div ref={buttonRef} />
          {!ready && (
            <div className="text-xs text-muted-foreground">Loading Google…</div>
          )}
          {signingIn && (
            <div className="absolute text-xs text-muted-foreground">Signing in…</div>
          )}
        </div>

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