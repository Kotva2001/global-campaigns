import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert } from "lucide-react";

export const AccessDenied = ({ email }: { email?: string | null }) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-border bg-card p-8 text-center">
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            background: "linear-gradient(135deg, #ff2d95, #b44dff)",
            boxShadow: "0 0 24px rgba(255,45,149,0.4)",
          }}
        >
          <ShieldAlert className="h-7 w-7 text-white" />
        </div>
        <h1
          className="mb-2 text-xl font-bold"
          style={{
            background: "linear-gradient(90deg, #00f0ff, #ff2d95)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Access Denied
        </h1>
        <p className="mb-1 text-sm text-muted-foreground">
          Your Google account does not have access to this app.
        </p>
        {email && (
          <p className="mb-4 text-xs font-mono text-muted-foreground">{email}</p>
        )}
        <p className="mb-6 text-sm text-muted-foreground">
          Please contact an administrator to request access.
        </p>
        <Button
          variant="outline"
          className="w-full"
          onClick={async () => {
            await supabase.auth.signOut();
          }}
        >
          Sign out
        </Button>
      </Card>
    </div>
  );
};