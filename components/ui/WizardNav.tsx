import React from 'react';

type Props = {
  currentStep: number;
  totalSteps: number;
  basePath: string;
  labels?: string[];
  className?: string;
  variant?: 'default' | 'compact';
};

export const WizardNav = ({ currentStep, totalSteps, labels, className = '', variant = 'default' }: Props) => {
  const padding = variant === 'compact' ? 'py-3' : 'py-4';
  const step = Math.min(Math.max(currentStep, 1), totalSteps);
  const percent = totalSteps > 0 ? Math.round((step / totalSteps) * 100) : 0;
  const label = labels?.[step - 1];

  return (
    <div className={`w-full ${padding} ${className}`}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-xs font-medium text-gray-700">
          <span className="font-mono tabular-nums tracking-[0.12em] text-gray-500">
            STEP {step} / {totalSteps}
          </span>
          {label ? <span className="ml-2">{label}</span> : null}
        </p>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-blue-700">{percent}%</p>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={label ? `進捗 ${label}` : '進捗'}
        className="h-1 w-full overflow-hidden rounded-full bg-gray-200"
      >
        <div
          className="h-full rounded-full bg-blue-600 transition-[width] duration-[var(--motion-duration-reveal)] ease-[var(--motion-ease-out)]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
