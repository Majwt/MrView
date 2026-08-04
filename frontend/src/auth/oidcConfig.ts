declare global {
  interface Window { __APP_CONFIG__?: Record<string, string>; }
}

// ponytail: lazy so config fetched in main.tsx before render is visible at call time
function cfg() { return window.__APP_CONFIG__ ?? {}; }

export function oidcEnabled() { return !!(cfg().OIDC_AUTHORITY && cfg().OIDC_CLIENT_ID); }

export function oidcSettings() {
  const c = cfg();
  return {
    authority: c.OIDC_AUTHORITY ?? "",
    client_id: c.OIDC_CLIENT_ID ?? "",
    redirect_uri: window.location.origin,
    post_logout_redirect_uri: window.location.origin,
    scope: c.OIDC_SCOPE || "openid profile",
  };
}

export function apiUrl() { return cfg().API_URL || undefined; }
