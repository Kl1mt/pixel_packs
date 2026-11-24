import { Navigate, Outlet, useLocation } from 'react-router';
import { useOnboarding } from './useOnboarding.js';

/**
 * Onboarding is mandatory (GDD §17, T22): until it is done, the game pages (packs,
 * binder, history) send the player back to `/welcome`, which resumes the current step.
 * The binder stays open for its own tour step. Settings stay reachable.
 */
export function OnboardingGate() {
  const onboarding = useOnboarding();
  const { pathname, search } = useLocation();
  if (onboarding.status !== 'ready' || onboarding.state.stage === 'done') return <Outlet />;
  const touring =
    onboarding.state.stage === 'tour' &&
    pathname === '/binder' &&
    new URLSearchParams(search).get('tour') === '1';
  return touring ? <Outlet /> : <Navigate to="/welcome" replace />;
}
