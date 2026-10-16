import React, { forwardRef, useId } from 'react';
import { fieldBaseClass, fieldStateClass } from '@/components/form/Input';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
  containerClassName?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', containerClassName = '', id, ...props }, ref) => {
    const autoId = useId();
    const textareaId = id ?? autoId;
    const messageId = error ? `${textareaId}-msg` : undefined;

    return (
      <div className={`mb-4 w-full min-w-0 ${containerClassName}`}>
        {label ? (
          <label htmlFor={textareaId} className="mb-1 block text-sm font-medium text-gray-700">
            {label}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={error ? true : undefined}
          aria-describedby={messageId}
          className={`${fieldBaseClass} ${fieldStateClass(error)} ${className}`}
          {...props}
        />
        {error ? (
          <p id={messageId} className="mt-1 text-sm text-red-600">
            {error}
          </p>
        ) : null}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
