// components/pdf/PDFTrigger.tsx
'use client';

import React from 'react';

type PDFTriggerProps = {
  data: any;
  disabled?: boolean;
};

export const PDFTrigger = ({ data, disabled = false }: PDFTriggerProps) => {
  const resumeId = data?.resume?.resume_id || data?.resume_id;
  const profilePhotoUrl = data?.resume?.profilePhotoUrl ?? null;

  if (!resumeId || disabled) {
    return (
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          disabled
          className="inline-flex items-center justify-center rounded-md bg-gray-300 px-6 py-3 text-sm font-medium text-white opacity-70 cursor-not-allowed"
        >
          {resumeId ? 'JIS履歴書をダウンロード' : '履歴書ID未設定'}
        </button>
        {disabled ? <p className="text-xs text-amber-700">先に保存してください</p> : null}
      </div>
    );
  }

  const href = `/api/pdf/jis-resume?resumeId=${encodeURIComponent(resumeId)}${
    profilePhotoUrl ? '&showProfilePhoto=true' : ''
  }`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 shadow-sm"
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-3.5 w-3.5 opacity-80"><path d="M8 2.5v8m0 0L4.75 7.25M8 10.5l3.25-3.25M3 13.5h10" /></svg>
      JIS履歴書をダウンロード
    </a>
  );
};
