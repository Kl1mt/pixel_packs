import { discordStartUrl } from './api.js';
import { useProviders } from './useProviders.js';

/**
 * "Log in with Discord": a full-page link to the server's OAuth start. Renders
 * nothing unless the server has Discord credentials (T09: hidden cleanly).
 */
export function DiscordButton({ label }: { label: string }) {
  const { discord } = useProviders();
  if (!discord) return null;
  return (
    <div className="oauth">
      <span className="oauth__or">or</span>
      <a className="btn oauth__discord" href={discordStartUrl('login')}>
        {label}
      </a>
    </div>
  );
}
