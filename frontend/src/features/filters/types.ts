export type FilterField =
  | "fqdn"
  | "hostname"
  | "ip"
  | "mac"
  | "customer"
  | "distinct_edges"
  | "connections"
  | "first_seen"
  | "last_seen"
  | "protocol"
  | "service_name"
  | "service_port"
  | "seen_count"
  | "process_name"
  | "edge_first_seen"
  | "edge_last_seen";

export type FilterOperator =
  | "is"
  | "isNot"
  | "contains"
  | "greaterThan"
  | "lessThan"
  | "between"
  | "hasAnyValue";

export type FilterValueType = "text" | "number" | "date" | "select";
export type FilterTarget = "node" | "connection" | "both";

export type FilterRule = {
  id: string;
  field: FilterField;
  operator: FilterOperator;
  value: unknown;
};

export type FiltersState = {
  rules: FilterRule[];
};
