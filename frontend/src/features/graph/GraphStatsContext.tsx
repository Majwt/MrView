import { createContext, useContext, useState } from "react";

type GraphStatsContextValue = {
  lastConnectionUtc: string | null;
  setLastConnectionUtc: (v: string | null) => void;
};

const GraphStatsContext = createContext<GraphStatsContextValue | null>(null);

export function GraphStatsProvider({ children }: { children: React.ReactNode }) {
  const [lastConnectionUtc, setLastConnectionUtc] = useState<string | null>(null);
  return (
    <GraphStatsContext.Provider value={{ lastConnectionUtc, setLastConnectionUtc }}>
      {children}
    </GraphStatsContext.Provider>
  );
}

export function useGraphStats() {
  const ctx = useContext(GraphStatsContext);
  if (!ctx) throw new Error("useGraphStats must be used within GraphStatsProvider");
  return ctx;
}
