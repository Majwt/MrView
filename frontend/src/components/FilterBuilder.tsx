import { useState } from "react";

import type { FiltersAction } from "@/features/filters/filters-reducer";
import type { FilterField, FilterOperator } from "@/features/filters/types";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export type Props = {
  dispatch: React.Dispatch<FiltersAction>;
};

const fields: { label: string; value: FilterField }[] = [
  { label: "FQDN", value: "fqdn" },
  { label: "Hostname", value: "hostname" },
  { label: "IP", value: "ip" },
  { label: "MAC address", value: "mac" },
  { label: "Customer", value: "customer" },
  { label: "Distinct edges", value: "distinct_edges" },
  { label: "Connections", value: "connections" },
  { label: "First seen", value: "first_seen" },
  { label: "Last seen", value: "last_seen" },
];

const operators: { label: string; value: FilterOperator }[] = [
  { label: "is", value: "is" },
  { label: "is not", value: "isNot" },
  { label: "contains", value: "contains" },
  { label: "greater than", value: "greaterThan" },
  { label: "less than", value: "lessThan" },
  { label: "has any value", value: "hasAnyValue" },
];

export default function FilterBuilder({ dispatch }: Props) {
  const [field, setField] = useState<FilterField>("fqdn");
  const [operator, setOperator] = useState<FilterOperator>("contains");
  const [value, setValue] = useState("");

  const selectedField = fields.find((option) => option.value === field);

  function applyFilter() {
    dispatch({
      type: "addRule",
      rule: {
        id: crypto.randomUUID(),
        field,
        operator,
        value: operator === "hasAnyValue" ? true : value,
      },
    });

    setValue("");
  }

  return (
    <div className="grid grid-cols-[140px_1fr]">
      <div className="border-r p-2">
        {fields.map((option) => (
          <button
            key={option.value}
            type="button"
            className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-muted data-[active=true]:bg-muted"
            data-active={field === option.value}
            onClick={() => setField(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 p-3">
        <div className="text-sm font-medium">{selectedField?.label}</div>

        <Select value={operator} onValueChange={(nextOperator) => setOperator(nextOperator as FilterOperator)}>
          <SelectTrigger>
            <SelectValue placeholder="Operator" />
          </SelectTrigger>

          <SelectContent>
            {operators.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          disabled={operator === "hasAnyValue"}
          placeholder="Value..."
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              applyFilter();
            }
          }}
        />

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setValue("")}>
            Cancel
          </Button>

          <Button size="sm" onClick={applyFilter}>
            Apply filter
          </Button>
        </div>
      </div>
    </div>
  );
}
