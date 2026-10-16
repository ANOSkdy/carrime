import React, { forwardRef, useId } from 'react';

export const fieldBaseClass =
  'block w-full min-h-[44px] rounded-md border bg-white px-3 py-2 text-base text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500';

export const fieldStateClass = (error?: string) =>
  error ? 'border-red-500' : 'border-gray-300';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
  /** 入力欄の右側に表示する単位（年・月など） */
  suffix?: string;
  /** 入力欄右端にスピナーを表示する */
  loading?: boolean;
  /** ラッパー要素に付与するクラス */
  containerClassName?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, hint, suffix, loading, className = '', containerClassName = '', id, ...props },
    ref
  ) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const messageId = error || hint ? `${inputId}-msg` : undefined;

    return (
      <div className={`mb-4 w-full min-w-0 ${containerClassName}`}>
        {label ? (
          <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-gray-700">
            {label}
          </label>
        ) : null}
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              ref={ref}
              id={inputId}
              aria-invalid={error ? true : undefined}
              aria-describedby={messageId}
              className={`${fieldBaseClass} ${fieldStateClass(error)} ${loading ? 'pr-10' : ''} ${className}`}
              {...props}
            />
            {loading ? (
              <span
                role="status"
                aria-label="検索中"
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"
              />
            ) : null}
          </div>
          {suffix ? <span className="shrink-0 text-sm text-gray-600">{suffix}</span> : null}
        </div>
        {error ? (
          <p id={messageId} className="mt-1 text-sm text-red-600">
            {error}
          </p>
        ) : hint ? (
          <p id={messageId} className="mt-1 text-xs text-gray-500">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';
