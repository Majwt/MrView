import type { NewFeatureData } from "../model/types";

export async function fetchNewFeatureData(): Promise<NewFeatureData> {
  return Promise.resolve({ title: "New Feature" });
}
