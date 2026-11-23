import { z } from 'zod';

/**
 * Player settings (GDD §18, §20), kept in localStorage. Volumes and mute drive
 * the audio manager (`src/audio/`).
 */
const Volume = z.number().min(0).max(1);

export const SettingsSchema = z.object({
  /** `system` follows `prefers-reduced-motion`. */
  motion: z.enum(['system', 'reduced', 'full']),
  /** Removes shake and flashes and softens the Glitch flicker (photosensitivity). */
  reduceEffects: z.boolean(),
  volume: z.object({ master: Volume, music: Volume, sfx: Volume }),
  /** Silences everything without losing the volume levels. */
  muted: z.boolean(),
});
export type Settings = z.infer<typeof SettingsSchema>;
export type MotionPreference = Settings['motion'];

export const DEFAULT_SETTINGS: Settings = {
  motion: 'system',
  reduceEffects: false,
  volume: { master: 0.8, music: 0.6, sfx: 0.8 },
  muted: false,
};

export const SETTINGS_KEY = 'pixel-packs:settings:v1';

/** Parses stored JSON; unknown or broken values fall back to defaults field by field. */
export function parseSettings(raw: string | null): Settings {
  if (raw === null) return DEFAULT_SETTINGS;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return DEFAULT_SETTINGS;
  }
  const whole = SettingsSchema.safeParse(data);
  if (whole.success) return whole.data;
  const obj = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  const pick = <T>(schema: z.ZodType<T>, value: unknown, fallback: T): T => {
    const r = schema.safeParse(value);
    return r.success ? r.data : fallback;
  };
  const vol =
    typeof obj.volume === 'object' && obj.volume !== null
      ? (obj.volume as Record<string, unknown>)
      : {};
  const d = DEFAULT_SETTINGS;
  return {
    motion: pick(SettingsSchema.shape.motion, obj.motion, d.motion),
    reduceEffects: pick(z.boolean(), obj.reduceEffects, d.reduceEffects),
    volume: {
      master: pick(Volume, vol.master, d.volume.master),
      music: pick(Volume, vol.music, d.volume.music),
      sfx: pick(Volume, vol.sfx, d.volume.sfx),
    },
    muted: pick(z.boolean(), obj.muted, d.muted),
  };
}

/** Whether UI motion should be reduced, given the player's choice and the OS setting. */
export function resolveReducedMotion(motion: MotionPreference, systemPrefersReduced: boolean) {
  return motion === 'reduced' || (motion === 'system' && systemPrefersReduced);
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type SettingsPatch = Partial<Omit<Settings, 'volume'>> & {
  volume?: Partial<Settings['volume']>;
};

/** A tiny observable store (for `useSyncExternalStore`). */
export function createSettingsStore(storage: KeyValueStorage | null) {
  let state = parseSettings(safeGet(storage));
  const listeners = new Set<() => void>();
  const update = (patch: SettingsPatch): void => {
    state = SettingsSchema.parse({
      ...state,
      ...patch,
      volume: { ...state.volume, ...patch.volume },
    });
    try {
      storage?.setItem(SETTINGS_KEY, JSON.stringify(state));
    } catch {
      // Storage full or blocked (private mode): keep the in-memory value.
    }
    for (const l of listeners) l();
  };
  return {
    get: (): Settings => state,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update,
    reset: (): void => {
      update(DEFAULT_SETTINGS);
    },
  };
}
export type SettingsStore = ReturnType<typeof createSettingsStore>;

function safeGet(storage: KeyValueStorage | null): string | null {
  try {
    return storage?.getItem(SETTINGS_KEY) ?? null;
  } catch {
    return null;
  }
}
