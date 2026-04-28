import { useEffect, useState } from "react";

const isAllowed = (url: string) => {
  try {
    const u = new URL(url);
    return (
      u.hostname.endsWith("instagram.com") ||
      u.hostname.endsWith("youtube.com") ||
      u.hostname.endsWith("youtu.be")
    );
  } catch {
    return false;
  }
};

const RedirectPage = () => {
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get("url");

    if (!url || !isAllowed(url)) {
      setError("Invalid or missing redirect URL.");
      return;
    }

    setTarget(url);

    const meta = document.createElement("meta");
    meta.name = "referrer";
    meta.content = "no-referrer";
    document.head.appendChild(meta);

    window.location.replace(url);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          {error ?? "Redirecting…"}
        </p>
        {target && (
          <p className="text-xs text-muted-foreground/70 break-all max-w-md">
            If you are not redirected,{" "}
            <a href={target} className="underline">click here</a>.
          </p>
        )}
      </div>
    </div>
  );
};

export default RedirectPage;