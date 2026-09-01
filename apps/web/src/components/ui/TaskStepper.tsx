export function TaskStepper({
  steps,
  current,
  onSelect,
}: {
  steps: Array<{ id: string; label: string; done?: boolean }>;
  current: number;
  onSelect?: (index: number) => void;
}) {
  return (
    <ol className="task-stepper" aria-label="Các bước">
      {steps.map((step, index) => {
        const done = Boolean(step.done) || index < current;
        const active = index === current;
        return (
          <li key={step.id}>
            <button
              type="button"
              className={`task-stepper-chip${done ? ' is-done' : ''}${active ? ' is-current' : ''}`}
              aria-current={active ? 'step' : undefined}
              onClick={() => onSelect?.(index)}
            >
              <span className="task-stepper-index" aria-hidden="true">{done ? '✓' : index + 1}</span>
              {step.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
