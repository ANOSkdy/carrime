import React from 'react';
import { stagger } from '@/lib/ui/stagger';

type Props = {
  /** 0 始まり。表示は 01 から、時間差の順序にも使う */
  index: number;
  title: string;
  motion?: 'reveal' | 'none';
  children: React.ReactNode;
};

export const FormSection = ({ index, title, motion = 'reveal', children }: Props) => (
  <section className={motion === 'reveal' ? 'lx-reveal space-y-5' : 'space-y-5'} style={stagger(index)}>
    <div className="flex items-center gap-3 text-gray-900">
      <span className="font-mono text-[11px] tabular-nums tracking-[0.12em] text-gray-400">
        {String(index + 1).padStart(2, '0')}
      </span>
      <h3 className="text-[13px] font-semibold tracking-[0.12em] text-gray-900">{title}</h3>
      <span
        aria-hidden="true"
        className={`flex-1 ${motion === 'reveal' ? 'lx-rule' : 'lx-rule-static'}`}
      />
    </div>
    {children}
  </section>
);
