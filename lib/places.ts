import { metres } from './walks';

export type Place = { name: string; lat: number; lng: number };

/** The twelve city districts (Stadtkreise), pinned near the middle of each. */
export const districts: Place[] = [
  { name: 'Kreis 1 · Altstadt', lat: 47.3717, lng: 8.5423 },
  { name: 'Kreis 2 · Enge, Wollishofen, Leimbach', lat: 47.3505, lng: 8.5288 },
  { name: 'Kreis 3 · Wiedikon', lat: 47.3655, lng: 8.5105 },
  { name: 'Kreis 4 · Aussersihl', lat: 47.3772, lng: 8.5232 },
  { name: 'Kreis 5 · Industriequartier', lat: 47.3874, lng: 8.5203 },
  { name: 'Kreis 6 · Unterstrass, Oberstrass', lat: 47.3884, lng: 8.5452 },
  { name: 'Kreis 7 · Fluntern, Hottingen, Hirslanden, Witikon', lat: 47.3698, lng: 8.5755 },
  { name: 'Kreis 8 · Riesbach', lat: 47.3557, lng: 8.5552 },
  { name: 'Kreis 9 · Altstetten, Albisrieden', lat: 47.3852, lng: 8.4852 },
  { name: 'Kreis 10 · Höngg, Wipkingen', lat: 47.4003, lng: 8.5053 },
  { name: 'Kreis 11 · Oerlikon, Affoltern, Seebach', lat: 47.4198, lng: 8.5302 },
  { name: 'Kreis 12 · Schwamendingen', lat: 47.4052, lng: 8.5702 },
];

/** Main squares across the city, from the old town to the outer districts. */
export const squares: Place[] = [
  { name: 'Paradeplatz', lat: 47.3697, lng: 8.5390 },
  { name: 'Münsterhof', lat: 47.3701, lng: 8.5408 },
  { name: 'Lindenhof', lat: 47.3730, lng: 8.5407 },
  { name: 'Bürkliplatz', lat: 47.3668, lng: 8.5412 },
  { name: 'Bellevue', lat: 47.3669, lng: 8.5452 },
  { name: 'Sechseläutenplatz', lat: 47.3655, lng: 8.5465 },
  { name: 'Central', lat: 47.3770, lng: 8.5440 },
  { name: 'Bahnhofplatz · Zürich HB', lat: 47.3770, lng: 8.5397 },
  { name: 'Stauffacher', lat: 47.3732, lng: 8.5290 },
  { name: 'Helvetiaplatz', lat: 47.3757, lng: 8.5254 },
  { name: 'Limmatplatz', lat: 47.3846, lng: 8.5311 },
  { name: 'Escher-Wyss-Platz', lat: 47.3910, lng: 8.5118 },
  { name: 'Turbinenplatz', lat: 47.3905, lng: 8.5176 },
  { name: 'Albisriederplatz', lat: 47.3782, lng: 8.5101 },
  { name: 'Goldbrunnenplatz', lat: 47.3701, lng: 8.5136 },
  { name: 'Lindenplatz Altstetten', lat: 47.3880, lng: 8.4850 },
  { name: 'Wipkingerplatz', lat: 47.3925, lng: 8.5290 },
  { name: 'Rigiplatz', lat: 47.3873, lng: 8.5488 },
  { name: 'Kreuzplatz', lat: 47.3637, lng: 8.5560 },
  { name: 'Hegibachplatz', lat: 47.3601, lng: 8.5628 },
  { name: 'Marktplatz Oerlikon', lat: 47.4107, lng: 8.5443 },
  { name: 'Schwamendingerplatz', lat: 47.4051, lng: 8.5720 },
];

/** Every named place, squares first so a square wins over its district. */
export const places: Place[] = [...squares, ...districts];

export const inZurich = (lat: number, lng: number) => lat >= 47.25 && lat <= 47.5 && lng >= 8.35 && lng <= 8.75;

/** A square within 400 m, otherwise the nearest district within 3 km, otherwise “Zürich”. */
export function nearestPlace(lat: number, lng: number) {
  const nearest = (list: Place[], within: number) => {
    let best = { name: '', d: within };
    for (const p of list) { const d = metres([lng, lat], [p.lng, p.lat]); if (d < best.d) best = { name: p.name, d }; }
    return best.name;
  };
  return nearest(squares, 400) || nearest(districts, 3000) || 'Zürich';
}
