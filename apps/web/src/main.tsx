import { Component, type ErrorInfo, type ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import { PathScrollRestoration } from './components/PathScrollRestoration.js';
import { AppQueryProvider } from './lib/query.js';

class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
          <h1>Không mở được Smart Path</h1>
          <p>{this.state.error.message}</p>
        </main>
      );
    }
    return this.props.children;
  }
}

function mount() {
  const root = document.getElementById('root');
  if (!root) return;
  createRoot(root).render(
    <StrictMode>
      <RootErrorBoundary>
        <AppQueryProvider>
          <BrowserRouter>
            <PathScrollRestoration />
            <App />
          </BrowserRouter>
        </AppQueryProvider>
      </RootErrorBoundary>
    </StrictMode>,
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
  mount();
}
