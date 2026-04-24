import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";

interface Props {
  children: React.ReactNode;
}

export const LoginGate = ({ children }: Props) => {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Skeleton className="h-64 w-full max-w-sm bg-card" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-sm border-border bg-card p-8">
          <div className="mb-6 flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            <h1 className="text-base font-bold">Influencer ROI Tracker</h1>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};