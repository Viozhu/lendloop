"use client";

import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback: (retry: () => void) => ReactNode;
  className?: string;
};

/**
 * Convex's useQuery throws query errors during render. This keeps a failing
 * section from taking the whole page down and gives it a local retry.
 */
export class QueryErrorBoundary extends Component<Props, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  retry = () => this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }));

  render() {
    if (this.state.failed) return this.props.fallback(this.retry);
    // Remounting on retry re-subscribes the query.
    return (
      <div key={this.state.attempt} className={this.props.className}>
        {this.props.children}
      </div>
    );
  }
}
