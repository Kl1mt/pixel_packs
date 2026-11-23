import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { sessionStore } from './auth/useSession.js';
import { installTokens } from './design/tokens.js';
import { economyStore } from './economy/useEconomy.js';
import './audio/audio.js';
import './design/global.css';
import './components/components.css';
import './shell/shell.css';
import './pages/pages.css';
import './auth/auth.css';

installTokens();
void sessionStore.refresh();
// Another player (or none): drop the cached wallet and packs.
let userId: string | null = null;
sessionStore.subscribe(() => {
  const s = sessionStore.get();
  const next = s.status === 'user' ? s.user.id : null;
  if (next !== userId) economyStore.clear();
  userId = next;
});

const root = document.getElementById('root');
if (root === null) {
  throw new Error('Missing #root element');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
