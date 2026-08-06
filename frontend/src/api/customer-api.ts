import { apiGet } from "@/api/client";
import type { Customer } from "@/features/graph/types";

export function fetchAllCustomers(): Promise<Customer[]> {
  return apiGet<Customer[]>("/customers");
}

export function fetchCurrentCustomer(): Promise<Customer> {
  return apiGet<Customer>("/customers/me");
}

