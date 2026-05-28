import type { FilterRule, FiltersState } from "./types";


export type FiltersAction =
  | { type: "addRule"; rule: FilterRule }
  | { type: "removeRule"; id: string }
  | { type: "updateRule"; id: string; patch: Partial<FilterRule> }
  | { type: "clearRules" };

export const initialFilters: FiltersState = {
  rules: [],
};

export function filtersReducer(
  state: FiltersState,
  action: FiltersAction,
): FiltersState {
  switch (action.type) {
    case "addRule":
      return {
        ...state,
        rules: [...state.rules, action.rule],
      };

    case "removeRule":
      return {
        ...state,
        rules: state.rules.filter((rule) => rule.id !== action.id),
      };

    case "updateRule":
      return {
        ...state,
        rules: state.rules.map((rule) =>
          rule.id === action.id
            ? { ...rule, ...action.patch }
            : rule,
        ),
      };

    case "clearRules":
      return initialFilters;

    default:
      return state;
  }
}
