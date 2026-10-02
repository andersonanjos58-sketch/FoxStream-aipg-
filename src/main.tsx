import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Guard against unhandled errors or rejections in iframe sandbox
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    console.warn('Unhandled window error suppressed:', e.message || e.error);
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
  });

  window.addEventListener('unhandledrejection', (e) => {
    console.warn('Unhandled promise rejection suppressed:', e.reason);
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
