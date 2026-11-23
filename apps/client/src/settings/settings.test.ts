import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  createSettingsStore,
  parseSettings,
  resolveReducedMotion,
} from './settings.js';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
}

describe('settings', () => {
  it('falls back to defaults for missing or broken data', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{nope')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('42')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid fields and repairs invalid ones one by one', () => {
    const raw = JSON.stringify({ motion: 'reduced', reduceEffects: 'yes', volume: { sfx: 3 } });
    expect(parseSettings(raw)).toEqual({
      ...DEFAULT_SETTINGS,
      motion: 'reduced',
    });
  });

  it('reads settings saved before mute existed as unmuted', () => {
    const raw = JSON.stringify({ ...DEFAULT_SETTINGS, muted: undefined, motion: 'full' });
    expect(parseSettings(raw)).toEqual({ ...DEFAULT_SETTINGS, motion: 'full', muted: false });
    const muted = JSON.stringify({ ...DEFAULT_SETTINGS, muted: true });
    expect(parseSettings(muted).muted).toBe(true);
  });

  it('resolves reduced motion from the choice and the OS setting', () => {
    expect(resolveReducedMotion('system', true)).toBe(true);
    expect(resolveReducedMotion('system', false)).toBe(false);
    expect(resolveReducedMotion('full', true)).toBe(false);
    expect(resolveReducedMotion('reduced', false)).toBe(true);
  });

  it('persists updates, merges volumes and notifies subscribers', () => {
    const storage = memoryStorage();
    const store = createSettingsStore(storage);
    let calls = 0;
    const off = store.subscribe(() => (calls += 1));
    store.update({ reduceEffects: true, volume: { music: 0.25 } });
    expect(store.get().reduceEffects).toBe(true);
    expect(store.get().volume).toEqual({ ...DEFAULT_SETTINGS.volume, music: 0.25 });
    expect(parseSettings(storage.data.get(SETTINGS_KEY) ?? null)).toEqual(store.get());
    off();
    store.reset();
    expect(calls).toBe(1);
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
    expect(createSettingsStore(storage).get()).toEqual(DEFAULT_SETTINGS);
  });

  it('rejects out-of-range updates', () => {
    const store = createSettingsStore(memoryStorage());
    expect(() => {
      store.update({ volume: { master: 2 } });
    }).toThrow();
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
  });

  it('survives storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const store = createSettingsStore(broken);
    store.update({ motion: 'full' });
    expect(store.get().motion).toBe('full');
  });
});
