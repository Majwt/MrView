import { useState } from "react";
import { Plus, X } from "lucide-react";

import FilterBuilder from "./FilterBuilder";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  getFilterFieldDefinition,
  getFilterOperatorLabel,
} from "@/features/filters/filter-definitions";
import type { FilterSuggestions } from "@/features/filters/filter-suggestions";
import type { FiltersAction } from "@/features/filters/filters-reducer";
import type { FilterRule, FiltersState } from "@/features/filters/types";

type FilterBarProps = {
  dispatch: React.Dispatch<FiltersAction>;
  filters: FiltersState;
  suggestions: FilterSuggestions;
};

export default function FilterBar({ dispatch, filters, suggestions }: FilterBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {filters.rules.map((filter) => (
        <Badge
          key={filter.id}
          variant="secondary"
          className="h-7 gap-2 border border-primary/20 bg-primary/10 px-2 text-foreground hover:bg-primary/15 dark:border-primary/35 dark:bg-primary/20 dark:text-primary-foreground dark:hover:bg-primary/25"
        >
          <span>{formatFilterRule(filter)}</span>

          <button
            type="button"
            aria-label={`Remove ${filter.field} filter`}
            className="rounded-sm p-0.5 hover:bg-background/70"
            onClick={() => dispatch({ type: "removeRule", id: filter.id })}
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}

      {filters.rules.length > 0 ? (
        <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "clearRules" })}>
          Clear
        </Button>
      ) : null}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="default" size="sm">
            <Plus className="size-4" />
            Filter
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-105 p-0">
          <FilterBuilder
            dispatch={dispatch}
            onClose={() => setOpen(false)}
            suggestions={suggestions}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function formatFilterRule(filter: FilterRule) {
  const fieldLabel = getFilterFieldDefinition(filter.field).label;
  const operatorLabel = getFilterOperatorLabel(filter.operator);

  if (filter.operator === "hasAnyValue") {
    return `${fieldLabel} ${operatorLabel}`;
  }

  if (filter.operator === "between" && Array.isArray(filter.value)) {
    return `${fieldLabel} ${operatorLabel} ${filter.value[0]} and ${filter.value[1]}`;
  }

  return `${fieldLabel} ${operatorLabel} ${String(filter.value ?? "")}`;
}
