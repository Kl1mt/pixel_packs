import { Link, NavLink, Outlet } from 'react-router';
import { CurrencyBadge } from '../components/CurrencyBadge.js';
import { Icon } from '../components/Icon.js';
import { Panel } from '../components/Panel.js';
import { useApplySettingsToDocument } from '../settings/useSettings.js';
import { NAV_ITEMS } from './nav.js';

export interface Wallet {
  gold: number | null;
  gems: number | null;
  dust: number | null;
}

/** Until auth (T09) and the wallet fetch land, balances are unknown. */
const UNKNOWN_WALLET: Wallet = { gold: null, gems: null, dust: null };

/** Top bar (navigation, balances, settings) around every in-game screen. */
export function AppShell({ wallet = UNKNOWN_WALLET }: { wallet?: Wallet }) {
  useApplySettingsToDocument();
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Panel as="header" material="wood" className="shell__bar">
        <Link to="/" className="shell__brand">
          Pixel Packs
        </Link>
        <nav aria-label="Main" className="shell__nav">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className="shell__navlink">
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="shell__wallet" aria-label="Wallet">
          <CurrencyBadge currency="gold" amount={wallet.gold} />
          <CurrencyBadge currency="gems" amount={wallet.gems} />
          <CurrencyBadge currency="dust" amount={wallet.dust} />
        </div>
        <NavLink to="/settings" className="shell__settings">
          Settings
        </NavLink>
      </Panel>
      <main id="main" className="shell__main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
