import "./FilterItem.css";
import type { FilterOperation, FilterType, filter } from "../types/filter.ts";
import { SERVICE_FILTER_OPTIONS } from "../utils/portServices.ts";

type props = {
  filter: filter;
  onChange: (operation: FilterOperation, type: FilterType, value: string) => void;
  onRemove: () => void;
  fqdnSuggestions: string[];
}

function FilterItem({ filter, onChange, onRemove, fqdnSuggestions }: props) {
  const valueInputType = filter.type === "port" ? "number" : "text";
  const valuePlaceholder = filter.type === "port" ? "1433" : "value";
  const fqdnSuggestionsId = "fqdn-filter-suggestions";

  return (
    <div className="filter-item">
      <select
        className={`filter-select ${filter.operation}`}
        value={filter.operation}
        onChange={(event) => onChange(event.target.value as FilterOperation, filter.type, filter.value)}
      >
        <option value="include">Include</option>
        <option value="exclude">Exclude</option>
      </select>
      <span className="filter-text"> where </span>
      <select
        className="filter-select"
        value={filter.type}
        onChange={(event) => {
          const nextType = event.target.value as FilterType;
          const nextValue = nextType === "service" ? "" : filter.value;
          onChange(filter.operation, nextType, nextValue);
        }}
      >
        <option value="service">service</option>
        <option value="port">port</option>
        <option value="fqdn">fqdn</option>
        <option value="ip">ip</option>
        <option value="process">process</option>
        <option value="subnet">subnet</option>
      </select>
      <span className="filter-text"> is </span>
      {filter.type === "service" ? (
        <select
          className="filter-select"
          value={filter.value}
          onChange={(event) => onChange(filter.operation, filter.type, event.target.value)}
        >
          <option value="">Select service</option>
          {SERVICE_FILTER_OPTIONS.map((serviceName) => (
            <option key={serviceName} value={serviceName}>
              {serviceName}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="filter-input"
          type={valueInputType}
          value={filter.value}
          list={filter.type === "fqdn" ? fqdnSuggestionsId : undefined}
          placeholder={valuePlaceholder}
          onChange={(event) => onChange(filter.operation, filter.type, event.target.value)}
        />
      )}
      <datalist id={fqdnSuggestionsId}>
        {fqdnSuggestions.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>
      <button type="button" className="filter-remove" onClick={onRemove} aria-label="Remove filter">
        ×
      </button>
    </div>
  )

}

export default FilterItem;
