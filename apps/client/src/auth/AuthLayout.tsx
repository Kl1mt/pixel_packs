import type { ReactNode } from 'react';
import { CARD_CATALOG } from '@pixel-packs/shared';
import { Link, Outlet } from 'react-router';
import { Card, CardBack } from '../components/Card.js';
import { Panel } from '../components/Panel.js';
import { useApplySettingsToDocument } from '../settings/useSettings.js';

const HERO_CARD = CARD_CATALOG.find((c) => c.id === 'MOS-012');

/**
 * Frame for the logged-out screens: the wood bar, a pinned parchment letter for
 * the form, and a little still life of a pack and two cards on the table.
 */
export function AuthLayout() {
  useApplySettingsToDocument();
  return (
    <div className="shell auth">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Panel as="header" material="wood" className="shell__bar">
        <Link to="/login" className="shell__brand">
          Pixel Packs
        </Link>
      </Panel>
      <main id="main" className="shell__main auth__main" tabIndex={-1}>
        <div className="auth__form">
          <Outlet />
        </div>
        <div className="auth__table" aria-hidden="true">
          <img
            className="auth__pack"
            src="/assets/packs/mossgrove.png"
            alt=""
            width={192}
            height={192}
          />
          <CardBack className="auth__back" />
          {HERO_CARD && <Card card={HERO_CARD} className="auth__card" />}
        </div>
      </main>
    </div>
  );
}

/** The parchment letter that holds each auth form. */
export function AuthPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel className="pinned auth__panel">
      <h1 className="auth__title">{title}</h1>
      {children}
    </Panel>
  );
}
