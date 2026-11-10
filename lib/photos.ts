export const CATEGORIES = ['Reflection', 'Light', 'Shadow', 'Other'];
export const URL_TTL = 60 * 60 * 6; // signed image links last six hours

export type PhotoRow = {
  id: string; owner: string; author_name: string; title: string; caption: string; place: string;
  category: string; walk: string; shared: boolean; lat: number; lng: number; key: string; created_at: string;
};

export function toPhoto(p: PhotoRow, userId: string, url: string) {
  return {
    id: p.id, title: p.title, caption: p.caption, place: p.place, lat: p.lat, lng: p.lng,
    category: p.category, walk: p.walk, shared: p.shared ? 1 : 0, createdAt: Date.parse(p.created_at),
    author: p.author_name, mine: p.owner === userId, url,
  };
}
