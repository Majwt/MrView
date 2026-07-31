import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AuthProvider as OidcProvider, useAuth as useOidcAuth } from "react-oidc-context";
import { apiUrl, oidcEnabled, oidcSettings } from "./oidcConfig";

export type Role = "Admin" | "Customer";

export interface AuthContextValue {
  token: string | null;
  role: Role | null;
  customerId: number | null;
  name: string | null;
  email: string | null;
  isLoading: boolean;
  login: (token?: string) => void;
  logout: () => void;
}

const STORAGE_KEY = "axilanswer_token";

let _tokenRef: string | null = null;

// Falls back to oidc-client-ts sessionStorage so timing of React renders doesn't matter
export function getStoredToken(): string | null {
  if (_tokenRef) return _tokenRef;
  const cfg = window.__APP_CONFIG__ ?? {};
  if (cfg.OIDC_AUTHORITY && cfg.OIDC_CLIENT_ID) {
    try {
      const raw = sessionStorage.getItem(`oidc.user:${cfg.OIDC_AUTHORITY}:${cfg.OIDC_CLIENT_ID}`);
      if (raw) return (JSON.parse(raw) as { access_token?: string }).access_token ?? null;
    } catch {}
  }
  return null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

function resolveRole(claims: Record<string, unknown>): Role | null {
  const raw =
    claims["role"] ??
    claims["roles"] ??
    claims["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];
  if (Array.isArray(raw)) return (raw.find((r) => r === "Admin" || r === "Customer") as Role) ?? null;
  if (raw === "Admin" || raw === "Customer") return raw;
  return null;
}

function resolveCustomerId(claims: Record<string, unknown>): number | null {
  const raw = claims["customer_id"] ?? claims["extension_customer_id"];
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function resolveName(claims: Record<string, unknown>): string | null {
  const raw = claims["name"] ?? claims["preferred_username"] ?? claims["sub"];
  return typeof raw === "string" ? raw : null;
}

function resolveEmail(claims: Record<string, unknown>): string | null {
  const raw = claims["email"];
  return typeof raw === "string" ? raw : null;
}

function parseToken(token: string | null) {
  if (!token) return { token: null, role: null, customerId: null, name: null, email: null };
  const claims = decodeJwtPayload(token);
  if (!claims) return { token: null, role: null, customerId: null, name: null, email: null };
  return { token, role: resolveRole(claims), customerId: resolveCustomerId(claims), name: resolveName(claims), email: resolveEmail(claims) };
}

const AuthContext = createContext<AuthContextValue | null>(null);

function LocalAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(() => parseToken(localStorage.getItem(STORAGE_KEY)));

  _tokenRef = state.token; // sync update

  const login = useCallback((token?: string) => {
    if (!token) return;
    const next = parseToken(token);
    if (!next.role) throw new Error("Invalid token: missing role claim.");
    localStorage.setItem(STORAGE_KEY, token);
    setState(next);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    _tokenRef = null;
    setState({ token: null, role: null, customerId: null, name: null, email: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, isLoading: false, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function OidcAuthBridge({ children }: { children: React.ReactNode }) {
  const oidc = useOidcAuth();
  const [localState, setLocalState] = useState(() => parseToken(localStorage.getItem(STORAGE_KEY)));
  // ponytail: pre-true prevents flash-redirect between oidc.isLoading→false and exchange effect firing
  const [exchanging, setExchanging] = useState(() => new URLSearchParams(window.location.search).has("code"));

  useEffect(() => {
    if (!oidc.user || localState.token) return;
    setExchanging(true);
    fetch(`${apiUrl ?? "/api"}/auth/oidc-exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: oidc.user.access_token }),
    })
      .then(r => r.ok ? r.json() as Promise<{ token: string }> : Promise.reject(r.status))
      .then(({ token }) => {
        const next = parseToken(token);
        if (!next.role) throw new Error("missing role");
        localStorage.setItem(STORAGE_KEY, token);
        setLocalState(next);
      })
      .catch(() => { void oidc.removeUser(); })
      .finally(() => setExchanging(false));
  // ponytail: intentionally only re-runs when oidc.user identity changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oidc.user?.access_token]);

  _tokenRef = localState.token;

  const login = useCallback((token?: string) => {
    if (token) {
      const next = parseToken(token);
      if (!next.role) throw new Error("Invalid token: missing role claim.");
      localStorage.setItem(STORAGE_KEY, token);
      setLocalState(next);
    } else {
      void oidc.signinRedirect();
    }
  }, [oidc]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    _tokenRef = null;
    setLocalState({ token: null, role: null, customerId: null, name: null, email: null });
    void oidc.signoutRedirect();
  }, [oidc]);

  return (
    <AuthContext.Provider value={{ ...localState, isLoading: oidc.isLoading || exchanging, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (oidcEnabled) {
    return (
      <OidcProvider {...oidcSettings}>
        <OidcAuthBridge>{children}</OidcAuthBridge>
      </OidcProvider>
    );
  }
  return <LocalAuthProvider>{children}</LocalAuthProvider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
