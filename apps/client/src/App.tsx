import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppShell } from './shell/AppShell.js';
import { BinderPage } from './pages/BinderPage.js';
import { HomePage } from './pages/HomePage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { PacksPage } from './pages/PacksPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { StyleguidePage } from './pages/StyleguidePage.js';

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/packs', element: <PacksPage /> },
      { path: '/binder', element: <BinderPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/styleguide', element: <StyleguidePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
