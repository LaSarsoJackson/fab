/** Keep an unexpected renderer or data error from turning into a blank screen. */
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
