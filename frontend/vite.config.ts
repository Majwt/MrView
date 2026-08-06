import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { defineConfig } from "vitest/config";
import { env } from "process";

function git(command: string, fallback = "unknown"): string {
  try {
    return execSync(command, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return fallback;
  }
}

const gitInfo = {
  branch:
    env.VITE_GIT_BRANCH ??
    env.GITHUB_REF_NAME ??
    env.CI_COMMIT_REF_NAME ??
    git("git rev-parse --abbrev-ref HEAD"),
  commit:
    env.VITE_GIT_COMMIT ??
    env.GITHUB_SHA?.slice(0, 7) ??
    env.CI_COMMIT_SHORT_SHA ??
    git("git rev-parse --short HEAD"),
  commitLong: env.VITE_GIT_COMMIT_LONG ?? env.GITHUB_SHA ?? env.CI_COMMIT_SHA ?? git("git rev-parse HEAD"),
  commitDate: env.VITE_GIT_COMMIT_DATE ?? git("git log -1 --format=%cI"),
  tag:
    env.VITE_GIT_TAG ??
    (env.GITHUB_REF_TYPE === "tag"
      ? (env.GITHUB_REF_NAME ?? "unknown")
      : git("git describe --tags --exact-match")),
  buildDate: new Date().toISOString(),
  dirty: git("git status --porcelain", "") !== "",
};

// https://vite.dev/config/
export default defineConfig({
  define: {
    "import.meta.env.VITE_GIT_INFO": JSON.stringify(gitInfo),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: env.VITE_API_URL || "http://localhost:8088",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router"],
          "vendor-graph": ["graphology", "@react-sigma/core", "@sigma/edge-curve"],
          "vendor-d3": ["d3"],
          "vendor-charts": ["recharts"],
          "vendor-auth": ["oidc-client-ts", "react-oidc-context"],
          "vendor-ui": ["radix-ui", "lucide-react", "sonner", "vaul", "cmdk"],
        },
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
