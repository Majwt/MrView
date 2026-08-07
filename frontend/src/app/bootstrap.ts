type AuthConfigResponse = {
  oidc_authority?: string;
  oidc_client_id?: string;
  oidc_scope?: string;
};

export async function bootstrapAppConfig(): Promise<void> {
  try {
    const response = await fetch("/api/auth/config");
    if (!response.ok) {
      return;
    }

    const config = (await response.json()) as AuthConfigResponse;
    window.__APP_CONFIG__ = {
      OIDC_AUTHORITY: config.oidc_authority ?? "",
      OIDC_CLIENT_ID: config.oidc_client_id ?? "",
      OIDC_SCOPE: config.oidc_scope ?? "openid profile",
    };
  } catch {
    // Non-fatal: app falls back to local-only auth mode.
  }
}
