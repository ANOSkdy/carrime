import Link from 'next/link';
import React from 'react';

interface AppShellProps {
  title?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export const AppShell = ({ title, footer, children }: AppShellProps) => {
  const mainPaddingBottom = footer ? 'pb-24' : 'pb-6';

  return (
    <div className="flex min-h-dvh flex-col bg-gray-50 text-gray-900">
      <header className="fixed inset-x-0 top-0 z-20 border-b bg-white/95 backdrop-blur">
        <div className="flex h-14 w-full items-center justify-between px-4">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            Carrime
          </Link>
          {title ? (
            <p className="ml-4 flex-1 truncate text-right text-sm font-medium text-gray-700">
              {title}
            </p>
          ) : null}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pt-14" style={{ WebkitOverflowScrolling: 'touch' }}>
        <main className={`w-full px-4 ${mainPaddingBottom}`}>
          {children}
        </main>
      </div>

      {footer ? (
        <footer className="fixed inset-x-0 bottom-0 z-20 border-t bg-white/95 backdrop-blur">
          <div className="px-4 py-3">
            {footer}
          </div>
        </footer>
      ) : null}
    </div>
  );
};
