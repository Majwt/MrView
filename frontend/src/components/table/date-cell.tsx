import { formatTableDate } from "./format-date";

export function DateCell({ value, title }: { value: unknown; title?: string }) {
  return (
    <span className="block font-mono text-[11px] leading-4 tabular-nums" title={title}>
      {formatTableDate(value)}
    </span>
  );
}
