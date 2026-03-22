import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App, { AuthProvider } from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
