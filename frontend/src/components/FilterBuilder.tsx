import { useState } from "react";

import {
  filterFields,
  getDefaultOperatorForField,
  getOperatorsForField,
} from "@/features/filters/filter-definitions";
import type { FiltersAction } from "@/features/filters/filters-reducer";
import type { FilterField, FilterOperator } from "@/features/filters/types";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export type Props = {
  dispatch: React.Dispatch<FiltersAction>;
};

export default function FilterBuilder({ dispatch }: Props) {
  const initialField = filterFields[0].value;
  const [field, setField] = useState<FilterField>(initialField);
  const [operator, setOperator] = useState<FilterOperator>(
    getDefaultOperatorForField(initialField),
  );
  const [value, setValue] = useState("");
  const [endValue, setEndValue] = useState("");

  const selectedField = filterFields.find((option) => option.value === field) ?? filterFields[0];
  const operators = getOperatorsForField(field);
  const needsValue = operator !== "hasAnyValue";
  const isBetween = operator === "between";
  const canApply = !needsValue || (value.trim() !== "" && (!isBetween || endValue.trim() !== ""));

  function selectField(nextField: FilterField) {
    setField(nextField);
    setOperator(getDefaultOperatorForField(nextField));
    setValue("");
    setEndValue("");
  }

  function coerceValue(rawValue: string) {
    if (selectedField.valueType === "number") {
      return Number(rawValue);
    }

    return rawValue;
  }

  function getRuleValue() {
    if (operator === "hasAnyValue") {
      return true;
    }

    if (operator === "between") {
      return [coerceValue(value), coerceValue(endValue)];
    }

    return coerceValue(value);
  }

  function applyFilter() {
    if (!canApply) {
      return;
    }

    dispatch({
      type: "addRule",
      rule: {
        id: crypto.randomUUID(),
        field,
        operator,
        value: getRuleValue(),
      },
    });

    setValue("");
    setEndValue("");
  }

  return (
    <div className="grid grid-cols-[140px_1fr]">
      <div className="border-r p-2">
        {filterFields.map((option) => (
          <button
            key={option.value}
            type="button"
            className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-muted data-[active=true]:bg-muted"
            data-active={field === option.value}
            onClick={() => selectField(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 p-3">
        <div className="text-sm font-medium">{selectedField?.label}</div>

        <Select
          value={operator}
          onValueChange={(nextOperator) => setOperator(nextOperator as FilterOperator)}
        >
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

        {selectedField.valueType === "select" ? (
          <Select disabled={!needsValue} value={value} onValueChange={setValue}>
            <SelectTrigger>
              <SelectValue placeholder="Value..." />
            </SelectTrigger>

            <SelectContent>
              {selectedField.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className={isBetween ? "grid grid-cols-2 gap-2" : undefined}>
            <Input
              disabled={!needsValue}
              type={
                selectedField.valueType === "number"
                  ? "number"
                  : selectedField.valueType === "date"
                    ? "date"
                    : "text"
              }
              inputMode={selectedField.valueType === "number" ? "numeric" : undefined}
              placeholder={isBetween ? "From..." : "Value..."}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  applyFilter();
                }
              }}
            />

            {isBetween ? (
              <Input
                disabled={!needsValue}
                type={
                  selectedField.valueType === "number"
                    ? "number"
                    : selectedField.valueType === "date"
                      ? "date"
                      : "text"
                }
                inputMode={selectedField.valueType === "number" ? "numeric" : undefined}
                placeholder="To..."
                value={endValue}
                onChange={(event) => setEndValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    applyFilter();
                  }
                }}
              />
            ) : null}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setValue("");
              setEndValue("");
            }}
          >
            Cancel
          </Button>

          <Button size="sm" disabled={!canApply} onClick={applyFilter}>
            Apply filter
          </Button>
        </div>
      </div>
    </div>
  );
}
