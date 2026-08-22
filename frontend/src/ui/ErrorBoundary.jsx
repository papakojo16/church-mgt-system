import React from 'react';

// Top-level error boundary: prevents an uncaught render error from leaving the
// user staring at a blank white screen. Instead it shows the error plus a retry
// button, which also helps surface problems that would otherwise be invisible.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info);
  }

  handleReload = () => {
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .finally(() => window.location.reload());
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.error) {
      const { error } = this.state;
      return (
        <div className="error-screen">
          <div className="error-card">
            <h1>Something went wrong</h1>
            <p>The app hit an unexpected error and couldn&apos;t display this page.</p>
            <pre className="error-detail">{error && (error.stack || error.message || String(error))}</pre>
            <button className="btn primary" onClick={this.handleReload}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
