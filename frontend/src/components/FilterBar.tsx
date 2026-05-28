import { Plus, X } from "lucide-react";

import FilterBuilder from "./FilterBuilder";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  getFilterFieldDefinition,
  getFilterOperatorLabel,
  getFilterTarget,
} from "@/features/filters/filter-definitions";
import type { FiltersAction } from "@/features/filters/filters-reducer";
import type { FilterRule, FiltersState, FilterTarget } from "@/features/filters/types";

type FilterBarProps = {
  dispatch: React.Dispatch<FiltersAction>;
  filters: FiltersState;
  target: FilterTarget;
};

export default function FilterBar({ dispatch, filters, target }: FilterBarProps) {
  const rules = filters.rules.filter((rule) => getFilterTarget(rule.field) === target);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {rules.map((filter) => (
        <Badge key={filter.id} variant="secondary" className="h-7 gap-2 px-2">
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

      {rules.length > 0 ? (
        <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "clearRules", target })}>
          Clear
        </Button>
      ) : null}

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="size-4" />
            Filter
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-105 p-0">
          <FilterBuilder dispatch={dispatch} target={target} />
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
