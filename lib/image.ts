// Prepares a picture for upload in the browser. Every upload path uses this, so all pictures are
// treated alike: small supported files go up unchanged, larger ones are shrunk to MAX_IMAGE_EDGE.
import {MAX_STORED_IMAGE_BYTES, isImageType, keepsOriginal, outputType, scaledSize} from './image-policy.ts';

export async function prepareImage(file: File): Promise<Blob> {
  if (keepsOriginal(file)) return file;
  try {
    const bitmap = await createImageBitmap(file); // respects the photo's orientation
    const {width, height} = scaledSize(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d')!;
    const type = outputType(file.type);
    const encode = (as: string) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, as, 0.86));
    if (type === 'image/jpeg') { context.fillStyle = '#fff'; context.fillRect(0, 0, width, height); }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    let blob = await encode(type);
    if (blob && blob.size > MAX_STORED_IMAGE_BYTES && type !== 'image/jpeg') {
      // A very detailed PNG/WebP can stay too large: fall back to JPEG on white.
      context.globalCompositeOperation = 'destination-over';
      context.fillStyle = '#fff';
      context.fillRect(0, 0, width, height);
      blob = await encode('image/jpeg');
    }
    if (blob && isImageType(blob.type) && blob.size <= MAX_STORED_IMAGE_BYTES) return blob;
  } catch {}
  if (isImageType(file.type) && file.size <= MAX_STORED_IMAGE_BYTES) return file;
  throw new Error('This image could not be prepared for upload. Try another JPG, PNG or WebP.');
}

/** Uploads a prepared image into your own folder and returns its storage key. */
export async function uploadImage(supabase: import('@supabase/supabase-js').SupabaseClient, userId: string, image: Blob) {
  const key = `${userId}/${crypto.randomUUID()}`;
  const { error } = await supabase.storage.from('photos').upload(key, image, { contentType: image.type || 'image/jpeg' });
  if (error) throw new Error('The picture could not be uploaded. Please try again.');
  return key;
}
