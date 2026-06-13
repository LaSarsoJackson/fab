/**
 * App-wide error boundary for the lazy map mount. The map is code-split, so a
 * stale cached HTML shell pointing at a hashed chunk that no longer exists
 * (common right after a GitHub Pages deploy) rejects the dynamic import, and an
 * unexpected render error inside the map would otherwise leave a blank shell
 * with no path to recovery. Catch both here and offer an explicit reload.
 */
import React from "react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("The map shell failed to render:", error, info);
  }

  handleReload() {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const {
      title = "Something went wrong",
      message = "The map failed to load. Reload the page to try again.",
      reloadLabel = "Reload",
    } = this.props;

    return (
      <div className="app-shell-error" role="alert">
        <h1>{title}</h1>
        <p>{message}</p>
        <button
          type="button"
          className="app-shell-error-action"
          onClick={this.handleReload}
        >
          {reloadLabel}
        </button>
      </div>
    );
  }
}
