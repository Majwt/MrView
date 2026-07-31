
import { apiGetText } from "@/api/client";

export type Status = "Healthy" | "Degraded" | "Down";

export function fetchStatus(): Promise<Status> {
  return apiGetText("/healthz");
}
