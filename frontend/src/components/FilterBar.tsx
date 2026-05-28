import { Plus, X } from "lucide-react";

import FilterBuilder from "./FilterBuilder";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import type { FiltersAction } from "@/features/filters/filters-reducer";
import type { FiltersState } from "@/features/filters/types";

type FilterBarProps = {
  dispatch: React.Dispatch<FiltersAction>;
  filters: FiltersState;
};

export default function FilterBar({ dispatch, filters }: FilterBarProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {filters.rules.map((filter) => (
        <Badge key={filter.id} variant="secondary" className="h-7 gap-2 px-2">
          <span>
            {filter.field} {filter.operator} {String(filter.value ?? "")}
          </span>

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

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="size-4" />
            Filter
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-105 p-0">
          <FilterBuilder dispatch={dispatch} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
