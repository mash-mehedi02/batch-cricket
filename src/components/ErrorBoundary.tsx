import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl relative overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>

                        <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="w-10 h-10 text-rose-500" />
                        </div>

                        <h1 className="text-2xl font-black text-white mb-2 uppercase tracking-wide">
                            Something went wrong
                        </h1>

                        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                            We encountered an unexpected error. Don't worry, your data is safe. Let's get you back on track.
                        </p>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-4 font-bold tracking-wider uppercase text-sm flex items-center justify-center gap-2 transition-transform active:scale-95"
                            >
                                <RefreshCw size={18} />
                                Refresh Page
                            </button>

                            <button
                                onClick={() => window.location.href = '/'}
                                className="w-full bg-transparent hover:bg-white/5 border border-white/10 text-white rounded-xl py-4 font-bold tracking-wider uppercase text-sm flex items-center justify-center gap-2 transition-transform active:scale-95"
                            >
                                <Home size={18} />
                                Go to Home
                            </button>
                        </div>
                    </div>

                    <div className="mt-8 text-slate-500 text-xs text-center max-w-sm">
                        If this problem persists, please contact support.
                        <br />
                        Error details have been logged.
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
