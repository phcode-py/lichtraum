// Shared walk helpers (server and browser).

/** One GPS fix: [lng, lat, unix seconds, segment]. A new segment starts after each pause. */
export type WalkPoint = [number, number, number, number];

export type Walk = {
  id: string; title: string; description?: string; status: 'recording' | 'paused' | 'ended'; shared: boolean;
  startedAt: number; endedAt: number | null; distance: number; duration: number;
  path: WalkPoint[]; author: string; mine: boolean; ownerId?:string;participants?:{id:string;name:string}[];participating?:boolean;canEdit?:boolean;
};

export type WalkRow = {
  id: string; owner: string; author_name: string; title: string; description?: string; status: Walk['status']; shared: boolean;
  started_at: string; ended_at: string | null; distance_m: number; duration_s: number; path: WalkPoint[];
};

export function toWalk(w: WalkRow, userId: string): Walk {
  return {
    id: w.id, title: w.title, description:w.description??'', status: w.status, shared: w.shared,
    startedAt: Date.parse(w.started_at), endedAt: w.ended_at ? Date.parse(w.ended_at) : null,
    distance: w.distance_m, duration: w.duration_s, path: w.path ?? [], author: w.author_name, ownerId:w.owner, mine: w.owner === userId,
  };
}

/** Metres between two [lng, lat] positions. */
export function metres(a: [number, number], b: [number, number]) {
  const r = 6371000, rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad, dLng = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

/** Splits a track into drawable lines, one per recording segment. */
export function segments(path: WalkPoint[]): [number, number][][] {
  const lines: [number, number][][] = [];
  let current = -1;
  for (const [lng, lat, , seg] of path) {
    if (seg !== current) { lines.push([]); current = seg; }
    lines[lines.length - 1].push([lng, lat]);
  }
  return lines.filter(l => l.length > 1);
}

export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** “Tuesday evening walk” */
export function defaultWalkTitle(date = new Date()) {
  const h = date.getHours();
  const part = h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 22 ? 'evening' : 'night';
  return `${date.toLocaleDateString('en-GB', { weekday: 'long' })} ${part} walk`;
}
