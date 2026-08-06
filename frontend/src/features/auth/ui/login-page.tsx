import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/auth/AuthContext";
import { oidcEnabled, oidcSettings } from "@/auth/oidcConfig";
import { Button } from "@/components/ui/button";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLocalSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        setError(res.status === 401 ? "Invalid username or password." : "Login failed. Try again.");
        return;
      }
      const { token } = await res.json();
      login(token);
      navigate("/graph", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <section className="w-full max-w-md rounded-xl border bg-background p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <img src="/favicon.svg" alt="Logo" className="h-7 w-7" />
          <p className="font-heading text-lg font-semibold">AxiLANswer</p>
        </div>

        <div className="mb-4 space-y-1">
          <h1 className="font-heading text-xl font-semibold">Sign in</h1>
          <p className="text-sm text-muted-foreground">Enter your credentials to continue.</p>
        </div>

        <div className="flex flex-col gap-4">
          {oidcEnabled() && (
            <Button type="button" variant="outline" onClick={() => login()}>
              Sign in with {oidcSettings().authority ? new URL(oidcSettings().authority).hostname : "SSO"}
            </Button>
          )}

          <form onSubmit={handleLocalSubmit} className="flex flex-col gap-3">
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              type="text"
              placeholder="Username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={!username || !password || loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
