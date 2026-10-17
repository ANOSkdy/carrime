import React, { forwardRef, useId } from 'react';
import { fieldBaseClass, fieldStateClass } from '@/components/form/Input';

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  containerClassName?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className = '', containerClassName = '', id, children, ...props }, ref) => {
    const autoId = useId();
    const selectId = id ?? autoId;
    const messageId = error ? `${selectId}-msg` : undefined;

    return (
      <div className={`mb-4 w-full min-w-0 ${containerClassName}`}>
        {label ? (
          <label htmlFor={selectId} className="mb-1 block text-sm font-medium text-gray-700">
            {label}
          </label>
        ) : null}
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={messageId}
          className={`${fieldBaseClass} ${fieldStateClass(error)} ${className}`}
          {...props}
        >
          {children}
        </select>
        {error ? (
          <p id={messageId} className="mt-1 text-sm text-red-600">
            {error}
          </p>
        ) : null}
      </div>
    );
  }
);
Select.displayName = 'Select';
