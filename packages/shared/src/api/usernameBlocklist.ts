/**
 * Usernames that can't be registered (GDD §22): staff/system names and a short
 * list of slurs and obscenities. Matching ignores case, underscores, digits used
 * as letters (0→o, 1→i, 3→e, 4→a, 5→s, 7→t) and checks substrings.
 */
const RESERVED_EXACT = ['support', 'staff', 'system', 'root', 'official', 'help'];
const RESERVED_ANYWHERE = ['admin', 'moderator', 'pixelpacks'];

// Kept deliberately short; extend as needed. Substring match, so keep entries specific.
const OFFENSIVE = [
  'fuck',
  'shit',
  'cunt',
  'nigger',
  'nigga',
  'faggot',
  'retard',
  'whore',
  'slut',
  'rapist',
  'nazi',
  'hitler',
  'kike',
  'chink',
  'tranny',
];

const LEET: Readonly<Record<string, string>> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
};

export function normalizeUsername(name: string): string {
  return name
    .toLowerCase()
    .replace(/_/g, '')
    .replace(/[013457]/g, (d) => LEET[d] ?? d);
}

export function isUsernameBlocked(name: string): boolean {
  const n = normalizeUsername(name);
  if (RESERVED_EXACT.includes(n)) return true;
  return [...RESERVED_ANYWHERE, ...OFFENSIVE].some((w) => n.includes(w));
}
