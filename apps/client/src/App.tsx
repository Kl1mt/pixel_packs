import { createBrowserRouter, RouterProvider } from 'react-router';
import { AuthLayout } from './auth/AuthLayout.js';
import { ForgotPasswordPage } from './auth/ForgotPasswordPage.js';
import { GuestOnly, RequireAuth } from './auth/guards.js';
import { LoginPage } from './auth/LoginPage.js';
import { RegisterPage } from './auth/RegisterPage.js';
import { ResetPasswordPage } from './auth/ResetPasswordPage.js';
import { VerifyEmailPage } from './auth/VerifyEmailPage.js';
import { AppShell } from './shell/AppShell.js';
import { OnboardingGate } from './onboarding/OnboardingGate.js';
import { HomePage } from './pages/HomePage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { PacksPage } from './pages/PacksPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { StyleguidePage } from './pages/StyleguidePage.js';

const router = createBrowserRouter([
  {
    // Logged-out screens (T09). Email links land on reset/verify whether logged in or not.
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <GuestOnly children={<LoginPage />} /> },
      { path: '/register', element: <GuestOnly children={<RegisterPage />} /> },
      { path: '/forgot-password', element: <GuestOnly children={<ForgotPasswordPage />} /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/verify-email', element: <VerifyEmailPage /> },
    ],
  },
  {
    // The living style guide stays public, so its screenshot needs no account.
    path: '/styleguide',
    element: <AppShell />,
    children: [{ index: true, element: <StyleguidePage /> }],
  },
  {
    // Card lab (T11): public like the style guide; lazy so Pixi stays out of the main bundle.
    path: '/debug',
    element: <AppShell />,
    children: [
      {
        index: true,
        hydrateFallbackElement: <p className="on-ground">Loading the card lab…</p>,
        lazy: () => import('./pages/DebugPage.js').then((m) => ({ Component: m.DebugPage })),
      },
      {
        // Moment lab (T13): every reveal moment and tear, replayable and freezable.
        path: 'moments',
        hydrateFallbackElement: <p className="on-ground">Loading the moment lab…</p>,
        lazy: () => import('./pages/MomentLab.js').then((m) => ({ Component: m.MomentLab })),
      },
    ],
  },
  {
    element: <RequireAuth children={<AppShell />} />,
    children: [
      { path: '/', element: <HomePage /> },
      {
        // Onboarding (T16): courier, scripted packs, starter cards; the binder tour is on /binder.
        path: '/welcome',
        hydrateFallbackElement: <p className="on-ground">A moth is fluttering in…</p>,
        lazy: () =>
          import('./onboarding/WelcomePage.js').then((m) => ({ Component: m.WelcomePage })),
      },
      {
        // Until onboarding is done these send the player back to /welcome (T22).
        element: <OnboardingGate />,
        children: [
          { path: '/packs', element: <PacksPage /> },
          {
            // Binder, inspect and pull history (T15): lazy, so their chunk loads on first visit.
            path: '/binder',
            hydrateFallbackElement: <p className="on-ground">Opening the binder…</p>,
            lazy: () => import('./binder/BinderPage.js').then((m) => ({ Component: m.BinderPage })),
          },
          {
            path: '/binder/history',
            lazy: () =>
              import('./binder/HistoryPage.js').then((m) => ({ Component: m.HistoryPage })),
          },
        ],
      },
      { path: '/settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
