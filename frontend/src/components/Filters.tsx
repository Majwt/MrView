import "./Filters.css";
import type { Dispatch, SetStateAction } from "react";
import type { FilterOperation, FilterType, filter } from "../types/filter";
import FilterItem from "./FilterItem";

type Props = {
  filters: filter[];
  setFilters: Dispatch<SetStateAction<filter[]>>;
  fqdnSuggestions: string[];
};

function Filters({ filters, setFilters, fqdnSuggestions }: Props) {
  const addFilter = () => {
    setFilters([
      ...filters,
      { id: crypto.randomUUID(), type: "service", operation: "include", value: "" },
    ]);
  };

  const updateFilter = (id: string, patch: Partial<Pick<filter, "operation" | "type" | "value">>) => {
    setFilters(filters.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter((entry) => entry.id !== id));
  };

  return (
    <div className="filters">
      {filters.map((entry) => (
        <FilterItem
          key={entry.id}
          filter={entry}
          fqdnSuggestions={fqdnSuggestions}
          onChange={(nextOperation: FilterOperation, nextType: FilterType, nextValue: string) => updateFilter(entry.id, {
            operation: nextOperation,
            type: nextType,
            value: nextValue,
          })}
          onRemove={() => removeFilter(entry.id)}
        />
      ))}
      <button type="button" className="add-filter-button" onClick={addFilter}>
        + Add filter
      </button>
    </div>
  )

}

export default Filters;
