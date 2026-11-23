import {
  CARD_CATALOG,
  FRAME_MATERIALS,
  ICONS,
  MASTER_PALETTE,
  RARITIES,
  REALM_PALETTES,
  realmPaletteHex,
  type Card as CatalogCard,
  type Realm,
} from '@pixel-packs/shared';
import { Button } from '../components/Button.js';
import { Card, CardBack } from '../components/Card.js';
import { CurrencyBadge } from '../components/CurrencyBadge.js';
import { Icon } from '../components/Icon.js';
import { Panel } from '../components/Panel.js';
import { TYPE } from '../design/tokens.js';
import { NAV_ITEMS } from '../shell/nav.js';
import { PackShelf } from './PackShelf.js';

const byId = (id: string): CatalogCard => {
  const c = CARD_CATALOG.find((x) => x.id === id);
  if (!c) throw new Error(`unknown card ${id}`);
  return c;
};

/**
 * Living style guide (T07): the approved T06 style tile rebuilt from the real
 * components. `pnpm --filter @pixel-packs/client e2e` screenshots it.
 */
export function StyleguidePage() {
  return (
    <div className="guide">
      <header className="guide__head">
        <h1 className="page-title">Style guide</h1>
        <p className="muted-on-ground">Design tokens and components (GDD §16)</p>
      </header>
      <Palette />
      <TypeScale />
      <Parts />
      <Cards />
      <HomeFragment />
    </div>
  );
}

function Palette() {
  const strip = (realm: Realm) => (
    <>
      <p className="small muted">{REALM_PALETTES[realm]?.name ?? realm}</p>
      <div className="strip">
        {realmPaletteHex(realm).map((h, i) => (
          <i key={`${h}-${String(i)}`} style={{ background: h }} />
        ))}
      </div>
    </>
  );
  return (
    <Panel className="wide">
      <h2>Palette</h2>
      <div className="swatches">
        {Object.entries(MASTER_PALETTE).map(([k, v]) => (
          <div key={k} className="swatch">
            <i style={{ background: v }} />
            {k}
            <br />
            <span className="muted">{v}</span>
          </div>
        ))}
      </div>
      {strip('mossgrove')}
      {strip('starhollow')}
    </Panel>
  );
}

function TypeScale() {
  return (
    <Panel className="types">
      <h2>Type</h2>
      <p>
        <span className="label">Display · {TYPE.display.size} px (3× its 16 px glyph)</span>
        <span className="num" style={{ fontSize: 'var(--display)' }}>
          Wandering Post 1240
        </span>
      </p>
      <p>
        <span className="label">Heading &amp; numbers · {TYPE.heading.size} px (2×)</span>
        <span className="num">Open your satchel · 02:14:09</span>
      </p>
      <p>
        <span className="label">Body · storybook serif {TYPE.body.size} px</span>A moth courier
        lands on your windowsill with a satchel of cards, still warm from the road.
      </p>
      <p className="small">
        <span className="label">Small · {TYPE.small.size} px</span>Odds are shown on every pack.
        Scripted onboarding packs never count towards pity.
      </p>
    </Panel>
  );
}

function Parts() {
  return (
    <Panel material="wood">
      <h2>Panels, buttons &amp; icons</h2>
      <div className="row">
        <Button>Open</Button>
        <Button forceState="hover">Hover</Button>
        <Button forceState="pressed">Pressed</Button>
        <Button disabled>Locked</Button>
      </div>
      <p className="small muted">
        Rest · hover · pressed (sinks 2 px, edge shrinks) · disabled. Keyboard focus shows a dashed
        sunflower ring.
      </p>
      <Panel as="div">
        <h3>Parchment</h3>A 9-slice panel at 2×; it stretches to any size and its corners stay
        crisp.
      </Panel>
      <div className="row icons">
        {ICONS.map((n) => (
          <span key={n}>
            <Icon name={n} scale={3} />
            <span className="cap">{n}</span>
          </span>
        ))}
      </div>
      <div className="row">
        <CurrencyBadge currency="gold" amount={1240} />
        <CurrencyBadge currency="gems" amount={35} />
        <CurrencyBadge currency="dust" amount={180} />
        <CurrencyBadge currency="gold" amount={null} />
      </div>
    </Panel>
  );
}

function Cards() {
  const mos = byId('MOS-012');
  return (
    <Panel className="wide">
      <h2>Cards</h2>
      <div className="row">
        <Card card={mos} />
        <Card card={byId('STA-003')} />
        <CardBack />
      </div>
      <p className="small muted">
        Cards at 3×. Rarity shows as frame material plus 1–6 pips, never by colour alone. The art is
        bottom-aligned on the window&apos;s bottom row.
      </p>
      <div className="row frames">
        {RARITIES.map((r) => (
          <span key={r}>
            <Card card={mos} rarity={r} />
            <span className="cap">
              {r} · {FRAME_MATERIALS[r].name}
            </span>
          </span>
        ))}
      </div>
    </Panel>
  );
}

function HomeFragment() {
  return (
    <section className="wide">
      <h2 className="on-ground">Home (fragment)</h2>
      <div className="fragment">
        <Panel as="div" material="wood" className="fragment__bar">
          <nav aria-label="Example" className="shell__nav">
            {NAV_ITEMS.map((item, i) => (
              <a
                key={item.to}
                href="#home-fragment"
                className="shell__navlink"
                aria-current={i === 0 ? 'page' : undefined}
              >
                <Icon name={item.icon} />
                {item.label}
              </a>
            ))}
          </nav>
          <div className="shell__wallet">
            <CurrencyBadge currency="gold" amount={1240} />
            <CurrencyBadge currency="gems" amount={35} />
            <CurrencyBadge currency="dust" amount={180} />
          </div>
        </Panel>
        <Panel as="div" className="pinned">
          <h2>Free pack</h2>
          <div className="timer">
            <Icon name="timer" scale={3} />
            <span className="num">02:14:09</span>
          </div>
          <p>Your next satchel is on its way. One is waiting for you now.</p>
          <Button>Open packs</Button>
        </Panel>
        <Panel as="div" material="wood">
          <h2>Pack shelf</h2>
          <PackShelf />
        </Panel>
      </div>
    </section>
  );
}
