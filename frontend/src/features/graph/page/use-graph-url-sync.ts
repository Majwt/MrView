import type { FiltersAction } from "@/features/filters/filters-reducer";
import type { FiltersState } from "@/features/filters/types";
import type { QuickFilters } from "@/features/graph/ui/graph-quick-filters";
import { readUrlState, writeUrlState } from "@/features/url-state";
import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

type UseGraphUrlSyncParams = {
  filters: FiltersState;
  globalSearch: string;
  selectedNodeFqdn: string | null;
  quickFilters: QuickFilters;
  dispatchFilters: Dispatch<FiltersAction>;
  setSelectedNodeFqdn: Dispatch<SetStateAction<string | null>>;
  setGlobalSearch: Dispatch<SetStateAction<string>>;
  setQuickFilters: Dispatch<SetStateAction<QuickFilters>>;
};

export function useInitialGraphUrlState() {
  const [initialUrlState] = useState(readUrlState);
  return initialUrlState;
}

export function useGraphUrlSync({
  filters,
  globalSearch,
  selectedNodeFqdn,
  quickFilters,
  dispatchFilters,
  setSelectedNodeFqdn,
  setGlobalSearch,
  setQuickFilters,
}: UseGraphUrlSyncParams) {
  useEffect(() => {
    writeUrlState({
      filters,
      globalSearch,
      selectedNodeFqdn,
      tableView: "nodes",
      quickFilters,
    });
  }, [filters, globalSearch, selectedNodeFqdn, quickFilters]);

  useEffect(() => {
    function syncStateFromUrl() {
      const urlState = readUrlState();

      setSelectedNodeFqdn(urlState.selectedNodeFqdn);
      setGlobalSearch(urlState.globalSearch);
      setQuickFilters(urlState.quickFilters);
      dispatchFilters({ type: "replaceRules", rules: urlState.filters.rules });
    }

    window.addEventListener("popstate", syncStateFromUrl);

    return () => {
      window.removeEventListener("popstate", syncStateFromUrl);
    };
  }, [dispatchFilters, setGlobalSearch, setQuickFilters, setSelectedNodeFqdn]);
}
