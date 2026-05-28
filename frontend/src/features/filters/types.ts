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
  | "source_ip"
  | "target_ip";

export type FilterOperator =
  | "is"
  | "isNot"
  | "contains"
  | "greaterThan"
  | "lessThan"
  | "between"
  | "hasAnyValue";

export type FilterRule = {
  id: string;
  field: FilterField;
  operator: FilterOperator;
  value: unknown;
};

export type FiltersState = {
  rules: FilterRule[];
};
