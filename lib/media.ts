export const MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime';
export const VIDEO_TYPES: Record<string, string> = {'video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov'};
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export function mediaError(file: {type:string;size:number}): string {
  if (file.size === 0) return 'This file is empty. Choose another photo or video.';
  if (Object.hasOwn(VIDEO_TYPES, file.type)) return file.size <= MAX_VIDEO_BYTES ? '' : 'Choose a video under 50 MB.';
  if (['image/jpeg','image/png','image/webp'].includes(file.type)) return file.size <= 10 * 1024 * 1024 ? '' : 'Choose a photo under 10 MB.';
  return 'Choose a JPG, PNG, WebP photo or an MP4, WebM, MOV video.';
}

// Existing photo keys stay unchanged. Only videos have an extension and use the new bucket.
export const mediaKind = (key:string): 'photo'|'video' => /\.(mp4|webm|mov)$/.test(key) ? 'video' : 'photo';
export const mediaBucket = (key:string) => mediaKind(key) === 'video' ? 'videos' : 'photos';
export function validMediaKey(key:string, userId:string) {
  const [owner, name, extra] = key.split('/');
  return owner === userId && extra === undefined && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.(mp4|webm|mov))?$/.test(name ?? '');
}

export async function uploadMedia(supabase: import('@supabase/supabase-js').SupabaseClient, userId:string, file:File) {
  const error = mediaError(file);
  if (error) throw new Error(error);
  if (!file.type.startsWith('video/')) {
    const {prepareImage, uploadImage} = await import('./image');
    return uploadImage(supabase, userId, await prepareImage(file));
  }
  const key = `${userId}/${crypto.randomUUID()}.${VIDEO_TYPES[file.type]}`;
  const {error: uploadError} = await supabase.storage.from('videos').upload(key, file, {contentType:file.type, upsert:false});
  if (uploadError) throw new Error('The video could not be uploaded. Please try again.');
  return key;
}

/** Check that a post references an actual upload in the right bucket. */
export async function storedMediaExists(supabase: import('@supabase/supabase-js').SupabaseClient, key:string) {
  const {data, error} = await supabase.storage.from(mediaBucket(key)).info(key);
  if (error || !data || !data.size || !data.contentType) return false;
  if (mediaError({type:data.contentType, size:data.size})) return false;
  return mediaKind(key) === 'video'
    ? key.endsWith('.' + VIDEO_TYPES[data.contentType])
    : data.contentType.startsWith('image/');
}
