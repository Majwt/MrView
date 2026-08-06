import { useState } from "react";
import { ListFilter } from "lucide-react";

import FilterBuilder from "@/components/FilterBuilder";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { FilterSuggestions } from "@/features/filters/filter-suggestions";
import type { FiltersAction } from "@/features/filters/filters-reducer";
import type { FiltersState } from "@/features/filters/types";

type FilterBarProps = {
  dispatch: React.Dispatch<FiltersAction>;
  filters: FiltersState;
  suggestions: FilterSuggestions;
};

export default function FilterBar({ dispatch, filters, suggestions }: FilterBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="lg"
            className="h-9 rounded-xl border-foreground/20 px-3 data-[active=true]:border-primary/40 data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
            data-active={filters.rules.length > 0}
          >
            <ListFilter className="size-4" />
            {filters.rules.length > 0 ? `Filter Content (${filters.rules.length})` : "Filter Content"}
          </Button>
        </PopoverTrigger>

        {open ? (
          <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-0">
            <FilterBuilder
              dispatch={dispatch}
              filters={filters}
              onClose={() => setOpen(false)}
              suggestions={suggestions}
            />
          </PopoverContent>
        ) : null}
      </Popover>
    </div>
  );
}
