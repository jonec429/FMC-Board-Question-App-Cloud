'use client'; // Error components must be Client Components

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-red-100 max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-[24px] flex items-center justify-center mx-auto text-3xl font-black">
          !
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800">Something went wrong!</h2>
          <p className="text-slate-500 text-sm mt-2 font-medium">
            An unexpected error occurred in the application. We've logged the issue.
          </p>
        </div>
        <button
          onClick={
            // Attempt to recover by trying to re-render the segment
            () => reset()
          }
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
