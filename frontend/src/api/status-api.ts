
import { apiGetText } from "@/api/client";
import type { Status } from "@/components/AppSidebar";

export function fetchStatus(): Promise<Status> {
  return apiGetText("/healthz");
}
