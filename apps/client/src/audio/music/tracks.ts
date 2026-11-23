import { arpeggio, hits, type Step, type Track } from './score.js';

/**
 * M1 music (GDD §20), written in code because PixelLab's `/music` needs a higher
 * plan (§29 T14). Cozy lo-fi chiptune: soft pulse lead, triangle bass, quiet drums.
 */

// Home: F major, I–iii–IV–V / I–vi–IV–V, 16 bars (melody A then a calmer B).
const HOME_CHORDS = [
  [53, 57, 60, 64], // Fmaj7
  [57, 60, 64, 67], // Am7
  [58, 62, 65, 69], // Bbmaj7
  [55, 58, 60, 64], // C7
  [53, 57, 60, 64], // Fmaj7
  [50, 57, 62, 65], // Dm7
  [58, 62, 65, 69], // Bbmaj7
  [55, 58, 60, 64], // C7
] as const;
const HOME_ROOTS = [41, 45, 46, 48, 41, 50, 46, 48] as const;

const HOME_MELODY: Step[][] = [
  [
    [0, 72, 4],
    [4, 69, 2],
    [6, 72, 2],
    [8, 77, 6],
    [14, 76, 2],
  ],
  [
    [0, 76, 4],
    [4, 72, 4],
    [8, 69, 8],
  ],
  [
    [0, 74, 4],
    [4, 70, 2],
    [6, 74, 2],
    [8, 77, 4],
    [12, 76, 2],
    [14, 74, 2],
  ],
  [[0, 72, 12]],
  [
    [0, 69, 2],
    [2, 72, 2],
    [4, 77, 4],
    [8, 79, 4],
    [12, 77, 4],
  ],
  [
    [0, 76, 4],
    [4, 74, 4],
    [8, 69, 6],
    [14, 74, 2],
  ],
  [
    [0, 72, 4],
    [4, 70, 4],
    [8, 67, 4],
    [12, 70, 4],
  ],
  [
    [0, 67, 8],
    [8, 64, 4],
    [12, 67, 4],
  ],
  [
    [0, 77, 4],
    [4, 76, 4],
    [8, 72, 8],
  ],
  [
    [0, 72, 4],
    [4, 76, 4],
    [8, 79, 4],
    [12, 76, 4],
  ],
  [
    [0, 74, 8],
    [8, 70, 8],
  ],
  [
    [0, 72, 4],
    [4, 74, 4],
    [8, 76, 8],
  ],
  [
    [0, 77, 6],
    [6, 76, 2],
    [8, 72, 8],
  ],
  [
    [0, 74, 4],
    [4, 72, 4],
    [8, 69, 8],
  ],
  [
    [0, 70, 4],
    [4, 72, 4],
    [8, 74, 4],
    [12, 76, 4],
  ],
  [
    [0, 72, 8],
    [8, 67, 8],
  ],
];

export const HOME_TRACK: Track = {
  id: 'home',
  bpm: 84,
  bars: 16,
  parts: [
    { instrument: 'lead', layer: 'base', bars: HOME_MELODY },
    { instrument: 'arp', layer: 'base', bars: HOME_CHORDS.map((c) => arpeggio(c, 2, 2)) },
    {
      instrument: 'bass',
      layer: 'base',
      bars: HOME_ROOTS.map((r): Step[] => [
        [0, r, 6],
        [6, r + 7, 2],
        [8, r + 12, 4],
        [12, r + 7, 4],
      ]),
    },
    { instrument: 'kick', layer: 'base', bars: [hits([0, 10])] },
    { instrument: 'hat', layer: 'base', bars: [hits([4, 12]), hits([4, 12, 14])] },
  ],
};

// Opening: D minor, i–VI–VII–V at 100 bpm, a driving bass for anticipation.
const OPEN_CHORDS = [
  [62, 65, 69], // Dm
  [62, 65, 70], // Bb
  [64, 67, 72], // C
  [61, 64, 69], // A
] as const;
const OPEN_ROOTS = [38, 34, 36, 33] as const;

const OPEN_BELL: Step[][] = [
  [
    [0, 74, 8],
    [8, 77, 8],
  ],
  [
    [0, 77, 4],
    [4, 74, 4],
    [8, 70, 8],
  ],
  [
    [0, 72, 4],
    [4, 76, 4],
    [8, 79, 8],
  ],
  [
    [0, 81, 12],
    [12, 73, 4],
  ],
];

/** Layers: `base` always; `epic` (Epic pulls) adds a sparkle arp; `golden` adds bells. */
export const OPENING_TRACK: Track = {
  id: 'opening',
  bpm: 100,
  bars: 4,
  parts: [
    { instrument: 'arp', layer: 'base', bars: OPEN_CHORDS.map((c) => arpeggio(c, 2, 2)) },
    {
      instrument: 'bass',
      layer: 'base',
      bars: OPEN_ROOTS.map((r) => arpeggio([r, r, r + 12, r], 2, 2)),
    },
    { instrument: 'kick', layer: 'base', bars: [hits([0, 8])] },
    { instrument: 'hat', layer: 'base', bars: [hits([2, 6, 10, 14])] },
    {
      instrument: 'arp',
      layer: 'epic',
      bars: OPEN_CHORDS.map((c) => arpeggio([...c.map((n) => n + 12), c[1] + 24], 1, 1)),
    },
    { instrument: 'bell', layer: 'golden', bars: OPEN_BELL },
  ],
};

export const TRACKS = { home: HOME_TRACK, opening: OPENING_TRACK } as const;
export type TrackId = keyof typeof TRACKS;
