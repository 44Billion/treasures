import { Component, ErrorInfo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  lastPath: string;
  copied: boolean;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Translated fallback UI for the ErrorBoundary.
 * Rendered as a child so the `useTranslation` hook is available.
 */
function ErrorFallback({
  error,
  onReset,
  onGoHome,
  onReload,
  onCopy,
  copied,
}: {
  error: Error | null;
  onReset: () => void;
  onGoHome: () => void;
  onReload: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  const { t } = useTranslation();
  const isDev = import.meta.env.DEV;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" role="alert">
      <div className="max-w-md w-full space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {t('errorBoundary.title', 'Something went wrong')}
          </h2>
          <p className="text-muted-foreground">
            {t('errorBoundary.description', 'An unexpected error occurred.')}
          </p>
        </div>

        {/* Only expose stack traces in development. In production, a short
            error message is enough; the "Copy error details" button gives
            power users a way to share the full details. */}
        {isDev && (
          <div className="bg-muted p-4 rounded-lg">
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-foreground">
                {t('errorBoundary.details', 'Error details')}
              </summary>
              <div className="mt-2 space-y-2">
                <div>
                  <strong className="text-foreground">
                    {t('errorBoundary.message', 'Message:')}
                  </strong>
                  <p className="text-muted-foreground mt-1 break-words">
                    {error?.message}
                  </p>
                </div>
                {error?.stack && (
                  <div>
                    <strong className="text-foreground">
                      {t('errorBoundary.stack', 'Stack trace:')}
                    </strong>
                    <pre className="text-xs text-muted-foreground mt-1 overflow-auto max-h-32">
                      {error.stack}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={onReset}
            className="flex-1 min-h-11 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            {t('errorBoundary.tryAgain', 'Try again')}
          </button>
          <button
            onClick={onGoHome}
            className="flex-1 min-h-11 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
          >
            {t('errorBoundary.goHome', 'Go to Home')}
          </button>
          <button
            onClick={onReload}
            className="flex-1 min-h-11 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
          >
            {t('errorBoundary.reload', 'Reload page')}
          </button>
        </div>

        <div className="text-center">
          <button
            onClick={onCopy}
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 min-h-11 px-2"
          >
            {copied
              ? t('errorBoundary.copied', 'Copied')
              : t('errorBoundary.copyDetails', 'Copy error details')}
          </button>
        </div>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private pathPoll: number | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      lastPath: typeof window !== 'undefined' ? window.location.pathname : '',
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
      lastPath: window.location.pathname,
    });
    this.startPathWatcher();
  }

  componentWillUnmount() {
    this.stopPathWatcher();
  }

  // ErrorBoundary lives outside <BrowserRouter>, so react-router hooks are
  // unavailable. Poll window.location.pathname to auto-reset the boundary
  // when the user navigates (e.g. via the "Go to Home" button or browser back).
  startPathWatcher = () => {
    this.stopPathWatcher();
    this.pathPoll = window.setInterval(() => {
      if (!this.state.hasError) {
        this.stopPathWatcher();
        return;
      }
      if (window.location.pathname !== this.state.lastPath) {
        this.handleReset();
      }
    }, 250);
  };

  stopPathWatcher = () => {
    if (this.pathPoll !== null) {
      window.clearInterval(this.pathPoll);
      this.pathPoll = null;
    }
  };

  handleReset = () => {
    this.stopPathWatcher();
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      lastPath: window.location.pathname,
    });
  };

  handleGoHome = () => {
    // Navigate to home. Use history API so React Router picks it up when
    // the boundary resets.
    try {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch {
      window.location.assign('/');
      return;
    }
    this.handleReset();
  };

  handleReload = () => {
    window.location.reload();
  };

  handleCopy = async () => {
    const { error, errorInfo } = this.state;
    const payload = [
      `Path: ${window.location.pathname}`,
      `UA: ${navigator.userAgent}`,
      `Time: ${new Date().toISOString()}`,
      `Message: ${error?.message ?? ''}`,
      error?.stack ? `\nStack:\n${error.stack}` : '',
      errorInfo?.componentStack ? `\nComponent stack:\n${errorInfo.componentStack}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      // Fallback: silent; user can still reload/go home.
    }
    this.setState({ copied: true });
    window.setTimeout(() => this.setState({ copied: false }), 2000);
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <ErrorFallback
          error={this.state.error}
          onReset={this.handleReset}
          onGoHome={this.handleGoHome}
          onReload={this.handleReload}
          onCopy={this.handleCopy}
          copied={this.state.copied}
        />
      );
    }

    return this.props.children;
  }
}
