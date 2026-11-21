import {MAX_IMAGE_INPUT_BYTES, isImageType, storedImageOk} from './image-policy.ts';
import {MAX_VIDEO_INPUT_BYTES, storedVideoOk} from './video-policy.ts';

export const MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime';
export const VIDEO_TYPES: Record<string, string> = {'video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov'};
/** Largest original video a person can choose; it is converted to a ≤50 MB MP4 before upload. */
export const MAX_VIDEO_BYTES = MAX_VIDEO_INPUT_BYTES;

export function mediaError(file: {type:string;size:number}): string {
  if (file.size === 0) return 'This file is empty. Choose another photo or video.';
  if (Object.hasOwn(VIDEO_TYPES, file.type)) return file.size <= MAX_VIDEO_BYTES ? '' : 'Choose a video under 1 GB.';
  // Photos are shrunk in the browser before upload, so larger originals are fine.
  if (isImageType(file.type)) return file.size <= MAX_IMAGE_INPUT_BYTES ? '' : 'Choose a photo under 50 MB.';
  return 'Choose a JPG, PNG, WebP photo or an MP4, WebM, MOV video.';
}

/** Gallery tiles show a muted, paused video. The "#t=" fragment makes Safari paint the first frame
 * instead of a blank box. Playable players and local blob previews keep their URL unchanged. */
export function videoThumbnailSrc(url:string, controls=false) {
  if (controls || !/^https?:/.test(url) || url.includes('#')) return url;
  return url + '#t=0.001';
}

// Existing photo keys stay unchanged. Only videos have an extension and use the new bucket.
export const mediaKind = (key:string): 'photo'|'video' => /\.(mp4|webm|mov)$/.test(key) ? 'video' : 'photo';
export const mediaBucket = (key:string) => mediaKind(key) === 'video' ? 'videos' : 'photos';
export function validMediaKey(key:string, userId:string) {
  const [owner, name, extra] = key.split('/');
  return owner === userId && extra === undefined && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.(mp4|webm|mov))?$/.test(name ?? '');
}

/** Uploads a photo or video. Videos are converted first; `onProgress` receives 0–1 while that runs. */
export async function uploadMedia(supabase: import('@supabase/supabase-js').SupabaseClient, userId:string, file:File, onProgress?:(fraction:number)=>void) {
  const error = mediaError(file);
  if (error) throw new Error(error);
  if (!file.type.startsWith('video/')) {
    const {prepareImage, uploadImage} = await import('./image');
    return uploadImage(supabase, userId, await prepareImage(file));
  }
  const {prepareVideo} = await import('./video');
  const video = await prepareVideo(file, onProgress);
  const key = `${userId}/${crypto.randomUUID()}.${video.extension}`;
  const {error: uploadError} = await supabase.storage.from('videos').upload(key, video.blob, {contentType:video.type, upsert:false});
  if (uploadError) throw new Error('The video could not be uploaded. Please try again.');
  return key;
}

/** Check that a post references an actual upload in the right bucket. */
export async function storedMediaExists(supabase: import('@supabase/supabase-js').SupabaseClient, key:string) {
  const {data, error} = await supabase.storage.from(mediaBucket(key)).info(key);
  if (error || !data || !data.size || !data.contentType) return false;
  if (mediaKind(key) !== 'video') return storedImageOk({type:data.contentType, size:data.size});
  if (!Object.hasOwn(VIDEO_TYPES, data.contentType) || !storedVideoOk({size:data.size})) return false;
  return key.endsWith('.' + VIDEO_TYPES[data.contentType]);
}
