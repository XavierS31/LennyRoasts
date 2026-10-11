import { Component, type ReactNode } from "react";

/** The optional 3D bundle must not take the existing API interface down with it. */
export default class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    return this.state.failed
      ? <p className="scene-fallback glass-panel" role="status">The campus view could not load. Your idea form and API report are still available.</p>
      : this.props.children;
  }
}
