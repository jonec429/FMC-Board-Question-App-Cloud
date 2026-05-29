'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component:', error, errorInfo);
  }

  private handleRetry = () => {
    // A hard reload is the most robust way to recover from an SPA crash
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 m-4 bg-red-50 border border-red-100 rounded-3xl text-center">
          <div className="w-12 h-12 bg-red-100 text-red-500 rounded-2xl flex items-center justify-center text-2xl font-black mb-4">
            !
          </div>
          <h2 className="text-xl font-black text-slate-800 mb-2">Component Failed</h2>
          <p className="text-sm font-medium text-slate-500 mb-6 max-w-sm">
            {this.props.fallbackMessage || "An unexpected error occurred while loading this section of the app."}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-black hover:bg-slate-800 transition-all shadow-lg"
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
