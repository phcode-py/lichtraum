import { metres } from './walks';

export const places = [
  { name: 'Lindenhof', lat: 47.373, lng: 8.5407 }, { name: 'Grossmünster', lat: 47.3701, lng: 8.5441 },
  { name: 'Bürkliplatz', lat: 47.3668, lng: 8.5412 }, { name: 'Zürich HB', lat: 47.3782, lng: 8.5403 },
  { name: 'Zürich West', lat: 47.3895, lng: 8.5187 }, { name: 'Zürichhorn', lat: 47.3549, lng: 8.5503 },
  { name: 'Uetliberg', lat: 47.3495, lng: 8.4914 },
];

export const inZurich = (lat: number, lng: number) => lat >= 47.25 && lat <= 47.5 && lng >= 8.35 && lng <= 8.75;

/** Name of the nearest known place within 600 m, otherwise “Zürich”. */
export function nearestPlace(lat: number, lng: number) {
  let best = { name: 'Zürich', d: 600 };
  for (const p of places) { const d = metres([lng, lat], [p.lng, p.lat]); if (d < best.d) best = { name: p.name, d }; }
  return best.name;
}
