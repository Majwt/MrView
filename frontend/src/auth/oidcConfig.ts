declare global {
  interface Window { __APP_CONFIG__?: Record<string, string>; }
}

const cfg = window.__APP_CONFIG__ ?? {};

export const oidcEnabled = !!(cfg.OIDC_AUTHORITY && cfg.OIDC_CLIENT_ID);

export const oidcSettings = {
  authority: cfg.OIDC_AUTHORITY ?? "",
  client_id: cfg.OIDC_CLIENT_ID ?? "",
  redirect_uri: window.location.origin,
  post_logout_redirect_uri: window.location.origin,
  scope: cfg.OIDC_SCOPE || "openid profile",
};

export const apiUrl = cfg.API_URL || undefined;
