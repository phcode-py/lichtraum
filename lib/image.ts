// Prepares a photo for upload in the browser: shrinks large camera images and always produces JPEG/PNG/WebP.
const MAX_EDGE = 2400;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

export async function prepareImage(file: File): Promise<Blob> {
  if (ALLOWED.includes(file.type) && file.size < 1.5 * 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file); // respects the photo's orientation
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    if (blob) return blob;
  } catch {}
  if (ALLOWED.includes(file.type) && file.size <= 10 * 1024 * 1024) return file;
  throw new Error('This image could not be read. Try a JPG, PNG or WebP under 10 MB.');
}

/** Uploads a prepared image into your own folder and returns its storage key. */
export async function uploadImage(supabase: import('@supabase/supabase-js').SupabaseClient, userId: string, image: Blob) {
  const key = `${userId}/${crypto.randomUUID()}`;
  const { error } = await supabase.storage.from('photos').upload(key, image, { contentType: image.type || 'image/jpeg' });
  if (error) throw new Error('The picture could not be uploaded. Please try again.');
  return key;
}
