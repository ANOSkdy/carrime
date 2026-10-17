import React from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Input } from '@/components/form/Input';

type Props = {
  label: string;
  year: UseFormRegisterReturn;
  month: UseFormRegisterReturn;
  className?: string;
};

/** 年・月の2欄セット。親の幅に応じて均等に伸縮する */
export const YearMonthFields = ({ label, year, month, className = '' }: Props) => (
  <fieldset className={`min-w-0 ${className}`}>
    <legend className="mb-1 block text-sm font-medium text-gray-700">{label}</legend>
    <div className="grid grid-cols-[1.4fr_1fr] gap-2">
      <Input
        type="number"
        inputMode="numeric"
        aria-label={`${label}（年）`}
        suffix="年"
        containerClassName="mb-0"
        {...year}
      />
      <Input
        type="number"
        inputMode="numeric"
        aria-label={`${label}（月）`}
        suffix="月"
        containerClassName="mb-0"
        {...month}
      />
    </div>
  </fieldset>
);
