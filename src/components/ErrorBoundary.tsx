import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { crashed: boolean; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  render() {
    if (this.state.crashed) return null;
    return this.props.children;
  }
}
