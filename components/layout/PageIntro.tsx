import React from 'react';

type Props = {
  eyebrow: string;
  title: string;
  description?: string;
  motion?: 'reveal' | 'none';
};

export const PageIntro = ({ eyebrow, title, description, motion = 'reveal' }: Props) => (
  <header className={`mb-10 space-y-2 ${motion === 'reveal' ? 'lx-reveal' : ''}`}>
    <p className="lx-eyebrow font-mono text-gray-400">{eyebrow}</p>
    <h2 className="text-[22px] font-bold tracking-[0.06em] text-gray-900">{title}</h2>
    {description ? (
      <p className="text-[13px] leading-relaxed tracking-[0.04em] text-gray-500">{description}</p>
    ) : null}
  </header>
);
