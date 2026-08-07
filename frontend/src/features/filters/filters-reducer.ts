import { getFilterTarget } from "./filter-definitions";
import type { FilterRule, FiltersState, FilterTarget } from "./types";

export type FiltersAction =
  | { type: "addRule"; rule: FilterRule }
  | { type: "replaceRules"; rules: FilterRule[] }
  | { type: "removeRule"; id: string }
  | { type: "updateRule"; id: string; patch: Partial<FilterRule> }
  | { type: "clearRules"; target?: FilterTarget };

export const initialFilters: FiltersState = {
  rules: [],
};

export function filtersReducer(state: FiltersState, action: FiltersAction): FiltersState {
  switch (action.type) {
    case "addRule":
      return {
        ...state,
        rules: [...state.rules, action.rule],
      };

    case "replaceRules":
      return {
        ...state,
        rules: action.rules,
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
          rule.id === action.id ? { ...rule, ...action.patch } : rule,
        ),
      };

    case "clearRules":
      if (!action.target) {
        return initialFilters;
      }

      return {
        ...state,
        rules: state.rules.filter((rule) => getFilterTarget(rule.field) !== action.target),
      };

    default:
      return state;
  }
}
