import { useRef } from "react";
export default function Editor({
  label,
  filename,
  value,
  onChange,
  readOnly,
  badge,
  action,
  placeholder,
}: {
  label: string;
  filename: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  badge?: string;
  action?: React.ReactNode;
  placeholder?: string;
}) {
  const numbers = useRef<HTMLPreElement>(null);
  const count = value.split("\n").length;
  return (
    <section className="editor panel" aria-label={label}>
      <div className="editor-heading">
        <div>
          <span className="eyebrow">{label.toUpperCase()}</span>
          <div className="file-name" title={filename}>
            {filename}
          </div>
        </div>
        {action ?? (badge && <span className="pill">{badge}</span>)}
      </div>
      <div className="code-area">
        <div className="gutter" aria-hidden="true">
          <pre ref={numbers}>
            {Array.from({ length: count }, (_, i) => i + 1).join("\n")}
          </pre>
        </div>
        <textarea
          aria-label={label}
          value={value}
          readOnly={readOnly}
          wrap="off"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={placeholder}
          onChange={(e) => {
            onChange?.(e.target.value);
          }}
          onScroll={(e) => {
            if (numbers.current)
              numbers.current.style.transform = `translateY(-${e.currentTarget.scrollTop}px)`;
          }}
        />
      </div>
      <div className="editor-footer">
        <span>{value ? `${count} Zeilen` : "Noch kein Text"}</span>
        <span>UTF-8{readOnly ? " · Nur lesen" : ""}</span>
      </div>
    </section>
  );
}
