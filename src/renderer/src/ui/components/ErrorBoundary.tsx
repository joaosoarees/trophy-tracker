import { Component, type ErrorInfo, type ReactNode } from 'react';

import { SystemService } from '@app/services/SystemService';

interface IErrorBoundaryProps {
  /** Shown in place of the screen that crashed. */
  fallback: ReactNode;
  children: ReactNode;
}

interface IErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches an error thrown while drawing, so a broken screen shows a way out
 * instead of an empty window. The error goes to the local log file.
 */
export class ErrorBoundary extends Component<
  IErrorBoundaryProps,
  IErrorBoundaryState
> {
  state: IErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): IErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    SystemService.logError(
      'render',
      `${error.stack ?? error.message}\n${info.componentStack ?? ''}`,
    );
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
