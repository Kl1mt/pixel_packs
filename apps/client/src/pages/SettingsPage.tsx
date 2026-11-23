import { useEffect, useId, useState } from 'react';
import { fetchHealth } from '../api.js';
import { AccountPanel } from '../auth/AccountPanel.js';
import { useSession } from '../auth/useSession.js';
import { Button } from '../components/Button.js';
import { Panel } from '../components/Panel.js';
import type { MotionPreference, Settings } from '../settings/settings.js';
import { settingsStore, useReducedMotion, useSettings } from '../settings/useSettings.js';

const MOTION_OPTIONS: { value: MotionPreference; label: string }[] = [
  { value: 'system', label: 'Follow my device' },
  { value: 'reduced', label: 'Reduced' },
  { value: 'full', label: 'Full' },
];

const VOLUMES: { key: keyof Settings['volume']; label: string }[] = [
  { key: 'master', label: 'Master' },
  { key: 'music', label: 'Music' },
  { key: 'sfx', label: 'Sound effects' },
];

export function SettingsPage() {
  const settings = useSettings();
  const reduced = useReducedMotion();
  const id = useId();
  const session = useSession();
  return (
    <>
      <h1 className="page-title">Settings</h1>
      {session.status === 'user' && <AccountPanel user={session.user} />}
      <Panel className="narrow settings">
        <fieldset>
          <legend>
            <h2>Motion</h2>
          </legend>
          {MOTION_OPTIONS.map((o) => (
            <label key={o.value} className="choice">
              <input
                type="radio"
                name={`${id}-motion`}
                value={o.value}
                checked={settings.motion === o.value}
                onChange={() => {
                  settingsStore.update({ motion: o.value });
                }}
              />
              {o.label}
            </label>
          ))}
          <p className="muted small">Right now motion is {reduced ? 'reduced' : 'full'}.</p>
          <label className="choice">
            <input
              type="checkbox"
              checked={settings.reduceEffects}
              onChange={(e) => {
                settingsStore.update({ reduceEffects: e.target.checked });
              }}
            />
            Reduce effects (no shake or flashes, softer flicker)
          </label>
        </fieldset>
        <fieldset>
          <legend>
            <h2>Sound</h2>
          </legend>
          <label className="choice">
            <input
              type="checkbox"
              checked={settings.muted}
              onChange={(e) => {
                settingsStore.update({ muted: e.target.checked });
              }}
            />
            Mute all sound
          </label>
          {VOLUMES.map((v) => (
            <label key={v.key} className="slider">
              <span>{v.label}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(settings.volume[v.key] * 100)}
                onChange={(e) => {
                  settingsStore.update({ volume: { [v.key]: Number(e.target.value) / 100 } });
                }}
              />
              <span className="num">{Math.round(settings.volume[v.key] * 100)}</span>
            </label>
          ))}
        </fieldset>
        <div className="row">
          <Button
            onClick={() => {
              settingsStore.reset();
            }}
          >
            Reset
          </Button>
          <ServerStatus />
        </div>
      </Panel>
    </>
  );
}

function ServerStatus() {
  const [text, setText] = useState('Checking the post…');
  useEffect(() => {
    let live = true;
    fetchHealth()
      .then(() => {
        if (live) setText('The post is open.');
      })
      .catch(() => {
        if (live) setText('The post is closed right now.');
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <p className="muted small" data-testid="health" role="status">
      {text}
    </p>
  );
}
