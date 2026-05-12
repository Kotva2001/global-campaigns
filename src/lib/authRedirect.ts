const AUTH_HASH_KEYS = [
  "access_token",
  "refresh_token",
  "expires_in",
  "expires_at",
  "token_type",
  "type",
  "error",
  "error_description",
  "error_code",
];

const AUTH_SEARCH_KEYS = ["code", "error", "error_description", "error_code"];

let hasLoggedAuthConfig = false;

export const getAuthRedirectInfo = () => {
  if (typeof window === "undefined") {
    return {
      hasAuthParams: false,
      hasHashAccessToken: false,
      hasPkceCode: false,
      hasAuthError: false,
      urlFlowType: "none" as const,
    };
  }

  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  const searchParams = new URLSearchParams(window.location.search);
  const hasHashAccessToken = hashParams.has("access_token");
  const hasPkceCode = searchParams.has("code");
  const hasAuthError = hashParams.has("error") || searchParams.has("error");
  const hasAuthHash = AUTH_HASH_KEYS.some((key) => hashParams.has(key));
  const hasAuthSearch = AUTH_SEARCH_KEYS.some((key) => searchParams.has(key));

  return {
    hasAuthParams: hasAuthHash || hasAuthSearch,
    hasHashAccessToken,
    hasPkceCode,
    hasAuthError,
    urlFlowType: hasPkceCode ? ("pkce" as const) : hasAuthHash ? ("implicit" as const) : ("none" as const),
  };
};

export const clearAuthRedirectFromUrl = () => {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  url.hash = "";
  AUTH_SEARCH_KEYS.forEach((key) => url.searchParams.delete(key));
  const cleanUrl = `${url.pathname}${url.search}`;
  window.history.replaceState(window.history.state, document.title, cleanUrl);
};

export const isForbiddenAuthError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { status?: number; code?: string; message?: string; name?: string };
  const message = `${maybeError.message ?? ""} ${maybeError.code ?? ""} ${maybeError.name ?? ""}`.toLowerCase();
  return maybeError.status === 403 || message.includes("403") || message.includes("forbidden");
};

export const logAuthStartupConfig = () => {
  if (hasLoggedAuthConfig) return;
  hasLoggedAuthConfig = true;

  const redirectInfo = getAuthRedirectInfo();
  console.info("[Auth] Supabase client config", {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    configuredFlowType: "implicit",
    detectedUrlFlowType: redirectInfo.urlFlowType,
    hasHashAccessToken: redirectInfo.hasHashAccessToken,
    hasPkceCode: redirectInfo.hasPkceCode,
  });

  if (redirectInfo.hasPkceCode) {
    console.warn("[Auth] PKCE code parameter detected while the generated client is configured for implicit redirects.");
  }
};