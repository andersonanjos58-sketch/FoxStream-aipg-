import React from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { StorageService } from '../services/storageService';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('FoxStream caught an unhandled rendering error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    try {
      window.location.reload();
    } catch {
      // If reload is blocked by iframe sandbox, state reset allows re-rendering
    }
  };

  private handleResetData = () => {
    try {
      StorageService.clearAllCache();
      StorageService.clearHistory();
    } catch (e) {
      console.warn('Could not reset storage:', e);
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
    try {
      window.location.reload();
    } catch {
      // Fallback
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#090a0f] text-neutral-100 flex items-center justify-center p-4 font-['Outfit',sans-serif]">
          <div className="w-full max-w-lg p-6 sm:p-8 rounded-3xl bg-[#11131b] border border-neutral-800 shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center mx-auto shadow-lg shadow-orange-950/40">
              <AlertTriangle className="w-8 h-8 stroke-[2.2]" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Algo inesperado aconteceu
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400 max-w-sm mx-auto">
                O aplicativo FoxStream encontrou um erro e se recuperou com segurança. Suas listas salvas estão preservadas.
              </p>
            </div>

            {this.state.error && (
              <div className="text-left p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800/80 overflow-x-auto text-[11px] font-mono text-neutral-300 max-h-32">
                <span className="text-orange-400 font-bold">Erro: </span>
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                id="error-boundary-retry-btn"
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs shadow-lg shadow-orange-950/40 active:scale-95 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Recarregar FoxStream</span>
              </button>

              <button
                id="error-boundary-reset-btn"
                type="button"
                onClick={this.handleResetData}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white py-2.5 px-4 rounded-xl text-xs transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-neutral-400" />
                <span>Limpar Cache e Reiniciar</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
