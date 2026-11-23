import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { installTokens } from './design/tokens.js';
import './design/global.css';
import './components/components.css';
import './shell/shell.css';
import './pages/pages.css';

installTokens();

const root = document.getElementById('root');
if (root === null) {
  throw new Error('Missing #root element');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
