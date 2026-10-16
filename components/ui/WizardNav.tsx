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

  return (
    <div className={`w-full ${padding} ${className}`}>
      <div className="relative flex items-start justify-between gap-2">
        <div className="absolute left-0 right-0 top-5 -z-10 h-1 bg-gray-200">
          <div
            className="h-full origin-left bg-blue-600 transition-[width] duration-[var(--motion-duration-base)] ease-[var(--motion-ease-out)]"
            style={{ width: `${totalSteps > 1 ? ((Math.min(currentStep, totalSteps) - 1) / (totalSteps - 1)) * 100 : 0}%` }}
          />
        </div>

        {Array.from({ length: totalSteps }).map((_, i) => {
          const stepNum = i + 1;
          const isActive = stepNum <= currentStep;
          const isCurrent = stepNum === currentStep;

          let circleClass = "flex h-10 min-h-[44px] w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition-[background-color,border-color,color,transform] duration-[var(--motion-duration-base)]";
          if (isCurrent) circleClass += " scale-110";
          circleClass += isActive
            ? " bg-blue-600 border-blue-600 text-white"
            : " bg-white border-gray-300 text-gray-500";

          const labelClass = `mt-2 text-center text-[0.75rem] leading-4 font-medium break-words ${
            isCurrent ? 'text-blue-700' : 'text-gray-500'
          }`;

          return (
            <div key={stepNum} className="flex min-w-0 flex-1 flex-col items-center">
              <div className={circleClass}>{stepNum}</div>
              {labels && labels[i] && (
                <span className={labelClass}>{labels[i]}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
