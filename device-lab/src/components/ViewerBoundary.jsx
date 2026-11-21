import React from 'react';

export default class ViewerBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return this.props.fallback || (
      <p className="viewer-error" role="status">The 3D view could not open. Try a browser with hardware acceleration enabled.</p>
    );
    return this.props.children;
  }
}
