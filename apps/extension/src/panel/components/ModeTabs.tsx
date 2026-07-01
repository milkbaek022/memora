import type { LearningMode } from "@memora/shared";

const MODES: Array<{ value: LearningMode; label: string }> = [
  { value: "quick", label: "大概了解" },
  { value: "deep", label: "深入理解" },
  { value: "mastery", label: "深度理解" }
];

export function ModeTabs({
  value,
  disabled,
  onChange
}: {
  value: LearningMode;
  disabled: boolean;
  onChange(mode: LearningMode): void;
}) {
  return (
    <div className="mode-tabs" aria-label="学习模式">
      {MODES.map((mode) => (
        <button
          key={mode.value}
          type="button"
          disabled={disabled || value === mode.value}
          aria-pressed={value === mode.value}
          className={value === mode.value ? "active" : ""}
          onClick={() => onChange(mode.value)}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
