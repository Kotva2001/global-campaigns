import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export const AuthGate = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    const result = mode === "signup"
      ? await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      })
      : await supabase.auth.signInWithPassword({ email, password });

    if (result.error) toast.error(result.error.message);
    else if (mode === "signup") toast.success("Check your email to confirm your account.");
    setSubmitting(false);
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) toast.error(error.message);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (session) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{mode === "login" ? "Sign in" : "Create account"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <Button className="w-full" type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "login" ? "Sign in" : "Sign up"}
            </Button>
          </form>

          <Separator />

          <Button className="w-full" variant="outline" onClick={signInWithGoogle}>
            Continue with Google
          </Button>

          <Button className="w-full" variant="link" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "Create an account" : "Already have an account? Sign in"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};