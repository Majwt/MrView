export type ConnectionFilterField =
  | "direction"
  // Only source fields
  | "source_fqdn"
  | "source_ip"
  | "source_port"
  | "source_process_name"
  // Only target fields
  | "target_fqdn"
  | "target_ip"
  | "target_port"
  | "target_process_name"
  // Both source and target fields
  | "fqdn"
  | "ip"
  | "port"
  | "process_name"
  | "seen_count"
  | "last_seen";

export type ConnectionFilterOperator =
  | "equals"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "greaterThan"
  | "lessThan";

export type ConnectionFilter = {
  id: string;
  field: ConnectionFilterField;
  operator: ConnectionFilterOperator;
  value: string;
};
