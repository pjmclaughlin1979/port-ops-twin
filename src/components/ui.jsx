// Small presentational pieces shared by the tool panels. Clickable rows are
// plain <button>s (not calcite-list-item) so mouse and keyboard activation
// behave identically.

export function Stat({ label, value, tone }) {
  return (
    <div className={`stat ${tone ? `stat--${tone}` : ""}`}>
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
    </div>
  );
}

export function RowList({ children, empty }) {
  const items = [children].flat(Infinity).filter(Boolean);
  if (items.length === 0) return empty ? <p className="muted">{empty}</p> : null;
  return <ul className="row-list">{items}</ul>;
}

export function Row({ title, subtitle, meta, category, onClick, tone }) {
  const content = (
    <>
      {category && <span className={`swatch swatch--${category}`} aria-hidden="true" />}
      <span className="row__text">
        <span className="row__title">{title}</span>
        {subtitle && <span className="row__subtitle">{subtitle}</span>}
      </span>
      {meta != null && <span className={`row__meta ${tone ? `row__meta--${tone}` : ""}`}>{meta}</span>}
    </>
  );
  return (
    <li>
      {onClick ? (
        <button type="button" className="row" onClick={onClick}>
          {content}
        </button>
      ) : (
        <div className="row row--static">{content}</div>
      )}
    </li>
  );
}

export function Segmented({ value, options, onChange, label }) {
  return (
    <calcite-segmented-control
      width="full"
      scale="s"
      label={label}
      oncalciteSegmentedControlChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <calcite-segmented-control-item
          key={option.value}
          value={option.value}
          checked={option.value === value}
        >
          {option.label}
        </calcite-segmented-control-item>
      ))}
    </calcite-segmented-control>
  );
}

export function ToolIntro({ children }) {
  return <p className="tool-intro">{children}</p>;
}

export function Loading({ label }) {
  return <calcite-loader label={label} text={label} scale="s" />;
}
