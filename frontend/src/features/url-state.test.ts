import { describe, expect, it } from "vitest";
import { readUrlState } from "./url-state";

describe("readUrlState", () => {
  it("returns default state when window is unavailable", () => {
    const state = readUrlState();

    expect(state).toEqual({
      filters: { rules: [] },
      globalSearch: "",
      selectedNodeFqdn: null,
      tableView: "nodes",
      quickFilters: {
        hideIsolatedNodes: true,
        staleThresholdHours: 30 * 24,
        managedOnly: false,
      },
    });
  });
});
