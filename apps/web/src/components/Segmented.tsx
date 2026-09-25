interface Option<T extends string> {
  value: T;
  label: string;
}

/** Accessible single-choice button group (radiogroup semantics). */
export function Segmented<T extends string>(props: {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'md' | 'lg';
}) {
  return (
    <div
      className={`segmented segmented-${props.size ?? 'md'}`}
      role="radiogroup"
      aria-label={props.label}
    >
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === props.value}
          className={o.value === props.value ? 'active' : undefined}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
