import type { FilterField, FilterOperator, FilterTarget, FilterValueType } from "./types";

export type FilterFieldDefinition = {
  label: string;
  value: FilterField;
  target: FilterTarget;
  valueType: FilterValueType;
  options?: { label: string; value: string }[];
};

export const filterFields: FilterFieldDefinition[] = [
  { label: "FQDN", value: "fqdn", target: "both", valueType: "text" },
  { label: "Hostname", value: "hostname", target: "node", valueType: "text" },
  { label: "IP", value: "ip", target: "both", valueType: "text" },
  { label: "MAC address", value: "mac", target: "node", valueType: "text" },
  { label: "Customer", value: "customer", target: "node", valueType: "text" },
  { label: "# Distinct edges", value: "distinct_edges", target: "node", valueType: "number" },
  { label: "# Connections", value: "connections", target: "node", valueType: "number" },
  { label: "First seen", value: "first_seen", target: "both", valueType: "date" },
  { label: "Last seen", value: "last_seen", target: "both", valueType: "date" },
  {
    label: "Process",
    value: "process_name",
    target: "connection",
    valueType: "text",
  },
  {
    label: "Protocol",
    value: "protocol",
    target: "connection",
    valueType: "select",
    options: [
      { label: "TCP", value: "TCP" },
      { label: "UDP", value: "UDP" },
    ],
  },
  { label: "Service name", value: "service_name", target: "connection", valueType: "text" },
  { label: "Service port", value: "service_port", target: "connection", valueType: "number" },
  { label: "Seen count", value: "seen_count", target: "connection", valueType: "number" },
];

export const filterOperators: { label: string; value: FilterOperator }[] = [
  { label: "is", value: "is" },
  { label: "is not", value: "isNot" },
  { label: "contains", value: "contains" },
  { label: "greater than", value: "greaterThan" },
  { label: "less than", value: "lessThan" },
  { label: "between", value: "between" },
  { label: "has any value", value: "hasAnyValue" },
];

const operatorsByValueType: Record<FilterValueType, FilterOperator[]> = {
  text: ["contains", "is", "isNot", "hasAnyValue"],
  number: ["is", "isNot", "greaterThan", "lessThan", "between", "hasAnyValue"],
  date: ["is", "isNot", "greaterThan", "lessThan", "between", "hasAnyValue"],
  select: ["is", "isNot", "hasAnyValue"],
};

export function getFilterFieldDefinition(field: FilterField) {
  return filterFields.find((definition) => definition.value === field) ?? filterFields[0];
}

export function getFilterTarget(field: FilterField) {
  return getFilterFieldDefinition(field).target;
}

export function filterAppliesToTarget(field: FilterField, target: Exclude<FilterTarget, "both">) {
  const filterTarget = getFilterTarget(field);

  return filterTarget === "both" || filterTarget === target;
}

export function getFilterOperatorLabel(operator: FilterOperator) {
  return filterOperators.find((definition) => definition.value === operator)?.label ?? operator;
}

export function getOperatorsForField(field: FilterField) {
  const valueType = getFilterFieldDefinition(field).valueType;
  const operatorValues = operatorsByValueType[valueType];

  return filterOperators.filter((operator) => operatorValues.includes(operator.value));
}

export function getDefaultOperatorForField(field: FilterField) {
  return getOperatorsForField(field)[0].value;
}
