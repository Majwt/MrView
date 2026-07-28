import { Clock, Unlink } from "lucide-react";

export type QuickFilters = {
  hideIsolatedNodes: boolean;
  staleThresholdHours: number | null;
};

const STALE_OPTIONS: { label: string; hours: number; title: string }[] = [
  { label: "12h", hours: 12, title: "Hide nodes not seen in the last 12 hours" },
  { label: "1d", hours: 1 * 24, title: "Hide nodes not seen in the last 1 days" },
  { label: "3d", hours: 3 * 24, title: "Hide nodes not seen in the last 3 days" },
  { label: "7d", hours: 7 * 24, title: "Hide nodes not seen in the last 7 days" },
  { label: "1m", hours: 30 * 24, title: "Hide nodes not seen in the last month" },
  { label: "3m", hours: 90 * 24, title: "Hide nodes not seen in the last 3 months" },
  { label: "6m", hours: 180 * 24, title: "Hide nodes not seen in the last 6 months" },
  { label: "1y", hours: 365 * 24, title: "Hide nodes not seen in the last year" },
];

type GraphQuickFiltersProps = {
  quickFilters: QuickFilters;
  onToggleIsolated: () => void;
  onSetStaleThreshold: (days: number | null) => void;
};

const pillClass =
  "inline-flex h-8 items-center gap-1.5 rounded-md border border-foreground/20 bg-background/90 px-2.5 text-xs backdrop-blur transition-colors hover:bg-muted data-[active=true]:border-primary/60 data-[active=true]:bg-primary/20 data-[active=true]:text-primary";

export default function GraphQuickFilters({
  quickFilters,
  onToggleIsolated,
  onSetStaleThreshold,
}: GraphQuickFiltersProps) {
  return (
    <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
      <button
        type="button"
        onClick={onToggleIsolated}
        data-active={quickFilters.hideIsolatedNodes}
        className={pillClass}
        title="Hide isolated nodes (nodes with no connections)"
      >
        <Unlink className="size-3.5" />
        Hide isolated
      </button>

      <div className="h-4 w-px bg-foreground/20" />

      <Clock className="size-3.5 text-muted-foreground" />

      {STALE_OPTIONS.map(({ label, hours, title }) => (
        <button
          key={hours}
          type="button"
          onClick={() =>
            onSetStaleThreshold(quickFilters.staleThresholdHours === hours ? null : hours)
          }
          data-active={quickFilters.staleThresholdHours === hours}
          className={pillClass}
          title={title}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
