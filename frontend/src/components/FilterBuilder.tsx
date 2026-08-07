import { useId, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import {
  filterFields,
  getDefaultOperatorForField,
  getFilterFieldDefinition,
  getOperatorsForField,
} from "@/features/filters/filter-definitions";
import type { FilterSuggestions } from "@/features/filters/filter-suggestions";
import type { FiltersAction } from "@/features/filters/filters-reducer";
import type { FilterField, FilterOperator, FilterRule, FiltersState } from "@/features/filters/types";
import { cn } from "@/lib/utils";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

type DraftFilterRow = {
  id: string;
  field: FilterField;
  operator: FilterOperator;
  value: string;
  endValue: string;
};

export type Props = {
  dispatch: React.Dispatch<FiltersAction>;
  filters: FiltersState;
  onClose: () => void;
  suggestions: FilterSuggestions;
};

export default function FilterBuilder({ dispatch, filters, onClose, suggestions }: Props) {
  const suggestionsListBaseId = useId();
  const [rows, setRows] = useState<DraftFilterRow[]>(() => getInitialRows(filters.rules));
  const canApply = rows.every(isValidRow);

  function applyFilters() {
    if (!canApply) {
      return;
    }

    dispatch({
      type: "replaceRules",
      rules: rows.map((row) => ({
        id: crypto.randomUUID(),
        field: row.field,
        operator: row.operator,
        value: getRuleValue(row),
      })),
    });
    onClose();
  }

  return (
    <div className="w-[min(calc(100vw-2rem),560px)] p-3">
      <div className="mb-3 text-sm font-medium">Filter content where:</div>

      <div className="space-y-2">
        {rows.map((row, rowIndex) => (
          <FilterDraftRow
            key={row.id}
            row={row}
            suggestionsListId={`${suggestionsListBaseId}-${row.id}`}
            suggestions={suggestions}
            onAdd={() => setRows((currentRows) => insertRowAfter(currentRows, rowIndex))}
            onApply={applyFilters}
            onChange={(patch) =>
              setRows((currentRows) =>
                currentRows.map((currentRow) =>
                  currentRow.id === row.id ? { ...currentRow, ...patch } : currentRow,
                ),
              )
            }
            onDelete={() =>
              setRows((currentRows) =>
                currentRows.length === 1
                  ? [createDefaultRow()]
                  : currentRows.filter((currentRow) => currentRow.id !== row.id),
              )
            }
          />
        ))}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        {filters.rules.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              dispatch({ type: "replaceRules", rules: [] });
              onClose();
            }}
          >
            Clear Filters
          </Button>
        ) : null}

        <div className="flex-1" />

        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>

        <Button size="sm" disabled={!canApply} onClick={applyFilters}>
          Apply Filter
        </Button>
      </div>
    </div>
  );
}

type FilterDraftRowProps = {
  row: DraftFilterRow;
  suggestionsListId: string;
  suggestions: FilterSuggestions;
  onAdd: () => void;
  onApply: () => void;
  onChange: (patch: Partial<DraftFilterRow>) => void;
  onDelete: () => void;
};

function FilterDraftRow({
  row,
  suggestionsListId,
  suggestions,
  onAdd,
  onApply,
  onChange,
  onDelete,
}: FilterDraftRowProps) {
  const selectedField = getFilterFieldDefinition(row.field);
  const operators = getOperatorsForField(row.field);
  const fieldSuggestions = suggestions[row.field] ?? [];
  const isBetween = row.operator === "between";
  const shouldSuggestValues = selectedField.valueType === "text" && fieldSuggestions.length > 0;
  const inputType =
    selectedField.valueType === "number"
      ? "number"
      : selectedField.valueType === "date"
        ? "date"
        : "text";

  const valueInput = useMemo(() => {
    if (selectedField.valueType === "select") {
      return (
        <Select value={row.value} onValueChange={(value) => onChange({ value })}>
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Value" />
          </SelectTrigger>

          <SelectContent>
            {selectedField.options?.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    return (
      <div className={cn("grid min-w-0 gap-2", isBetween ? "grid-cols-2" : "grid-cols-1")}>
        <Input
          type={inputType}
          inputMode={selectedField.valueType === "number" ? "numeric" : undefined}
          placeholder={isBetween ? "From" : "Value"}
          value={row.value}
          list={shouldSuggestValues ? suggestionsListId : undefined}
          onChange={(event) => onChange({ value: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onApply();
            }
          }}
        />

        {isBetween ? (
          <Input
            type={inputType}
            inputMode={selectedField.valueType === "number" ? "numeric" : undefined}
            placeholder="To"
            value={row.endValue}
            list={shouldSuggestValues ? suggestionsListId : undefined}
            onChange={(event) => onChange({ endValue: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onApply();
              }
            }}
          />
        ) : null}
      </div>
    );
  }, [
    inputType,
    isBetween,
    onApply,
    onChange,
    row.endValue,
    row.value,
    selectedField.options,
    selectedField.valueType,
    shouldSuggestValues,
    suggestionsListId,
  ]);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg border border-border/70 bg-transparent p-1.5">
      <Select
        value={row.field}
        onValueChange={(nextField) => {
          const field = nextField as FilterField;
          onChange({
            field,
            operator: getDefaultOperatorForField(field),
            value: "",
            endValue: "",
          });
        }}
      >
        <SelectTrigger className="h-8 w-full min-w-30 flex-1 sm:w-33 sm:flex-none">
          <SelectValue placeholder="Field" />
        </SelectTrigger>

        <SelectContent>
          <SelectGroup>
            {filterFields
              .filter((option) => !option.advanced)
              .map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
          </SelectGroup>

          <SelectSeparator />

          <SelectGroup>
            <SelectLabel>Advanced</SelectLabel>
            {filterFields
              .filter((option) => option.advanced)
              .map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select
        value={row.operator}
        onValueChange={(nextOperator) => {
          const operator = nextOperator as FilterOperator;
          onChange({
            operator,
            value: row.value,
            endValue: operator === "between" ? row.endValue : "",
          });
        }}
      >
        <SelectTrigger className="h-8 w-full min-w-30 flex-1 sm:w-32 sm:flex-none">
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

      <div className="min-w-36 flex-[1_1_150px]">{valueInput}</div>

      {shouldSuggestValues ? (
        <datalist id={suggestionsListId}>
          {fieldSuggestions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      ) : null}

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon-sm" aria-label="Delete filter row" onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>

        <Button variant="outline" size="icon-sm" aria-label="Add filter row" onClick={onAdd}>
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function getInitialRows(rules: FilterRule[]) {
  if (rules.length === 0) {
    return [createDefaultRow()];
  }

  return rules.map((rule) => {
    const values = Array.isArray(rule.value) ? rule.value : [rule.value, ""];

    return {
      id: crypto.randomUUID(),
      field: rule.field,
      operator: rule.operator,
      value: String(values[0] ?? ""),
      endValue: rule.operator === "between" ? String(values[1] ?? "") : "",
    };
  });
}

function createDefaultRow(): DraftFilterRow {
  const field = filterFields[0].value;

  return {
    id: crypto.randomUUID(),
    field,
    operator: getDefaultOperatorForField(field),
    value: "",
    endValue: "",
  };
}

function insertRowAfter(rows: DraftFilterRow[], index: number) {
  return [...rows.slice(0, index + 1), createDefaultRow(), ...rows.slice(index + 1)];
}

function isValidRow(row: DraftFilterRow) {
  if (row.operator === "between") {
    return row.value.trim() !== "" && row.endValue.trim() !== "";
  }

  return row.value.trim() !== "";
}

function getRuleValue(row: DraftFilterRow) {
  if (row.operator === "between") {
    return [coerceValue(row.field, row.value), coerceValue(row.field, row.endValue)];
  }

  return coerceValue(row.field, row.value);
}

function coerceValue(field: FilterField, rawValue: string) {
  if (getFilterFieldDefinition(field).valueType === "number") {
    return Number(rawValue);
  }

  return rawValue;
}
