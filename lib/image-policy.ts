// One upload policy for every picture (atlas photos, working notes, correspondence, walk sketches).
// People may choose large originals; the browser shrinks them before upload, so what is stored stays
// within the 10 MB that the Supabase buckets and database checks allow.
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const IMAGE_ACCEPT = IMAGE_TYPES.join(',');
/** Largest original a person can choose. */
export const MAX_IMAGE_INPUT_BYTES = 50 * 1024 * 1024;
/** Largest stored image (photos + paper-references buckets, attach checks in SQL). */
export const MAX_STORED_IMAGE_BYTES = 10 * 1024 * 1024;
/** Smaller supported files are uploaded unchanged. */
export const RESIZE_THRESHOLD_BYTES = 1.5 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 2400;

export const isImageType = (type: string) => IMAGE_TYPES.includes(type);
export const keepsOriginal = (file: {type: string; size: number}) => isImageType(file.type) && file.size < RESIZE_THRESHOLD_BYTES;

/** Fits an image inside MAX_IMAGE_EDGE without enlarging it. */
export function scaledSize(width: number, height: number, maxEdge = MAX_IMAGE_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale))};
}

/** PNG and WebP keep their format (line drawings, transparency); everything else becomes JPEG. */
export const outputType = (type: string) => (type === 'image/png' || type === 'image/webp' ? type : 'image/jpeg');

/** Can this already-stored image be attached? */
export const storedImageOk = (file: {type: string; size: number}) =>
  isImageType(file.type) && Number.isFinite(file.size) && file.size > 0 && file.size <= MAX_STORED_IMAGE_BYTES;
