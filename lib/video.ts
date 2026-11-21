// Converts a chosen video in the browser (WebCodecs via Mediabunny) before upload. Browser-only.
import {MAX_STORED_VIDEO_BYTES, VIDEO_STEPS, videoDurationError, videoSize} from './video-policy.ts';

export type PreparedVideo = {blob: Blob; type: string; extension: string};
const ORIGINAL_EXT: Record<string, string> = {'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov'};

/** Returns an H.264 MP4 (≤1080p, ≤50 MB). Falls back to the original file when this browser cannot convert. */
export async function prepareVideo(file: File, onProgress?: (fraction: number) => void): Promise<PreparedVideo> {
  const original = (): PreparedVideo => {
    if (file.size > MAX_STORED_VIDEO_BYTES) throw new Error('This browser cannot shrink videos. Choose a video under 50 MB, or use Safari or Chrome.');
    return {blob: file, type: file.type, extension: ORIGINAL_EXT[file.type] ?? 'mp4'};
  };
  if (typeof VideoEncoder === 'undefined') return original();
  const mb = await import('mediabunny');
  if (!(await mb.canEncodeVideo('avc').catch(() => false))) return original();

  const input = new mb.Input({source: new mb.BlobSource(file), formats: mb.ALL_FORMATS});
  try {
    let track: Awaited<ReturnType<typeof input.getPrimaryVideoTrack>>;
    let duration: number;
    try {
      track = await input.getPrimaryVideoTrack();
      duration = await input.computeDuration();
    } catch { return original(); }
    if (!track) throw new Error('This file has no video in it.');
    const tooLong = videoDurationError(duration);
    if (tooLong) throw new Error(tooLong);
    const [displayWidth, displayHeight] = await Promise.all([track.getDisplayWidth(), track.getDisplayHeight()]);

    for (const [index, step] of VIDEO_STEPS.entries()) {
      const target = new mb.BufferTarget();
      const output = new mb.Output({format: new mb.Mp4OutputFormat({fastStart: 'in-memory'}), target});
      const {width, height} = videoSize(displayWidth, displayHeight, step);
      // Primary tracks only: iPhone files also carry spatial audio and metadata tracks.
      const conversion = await mb.Conversion.init({input, output, tracks: 'primary', video: {codec: 'avc', width, height, fit: 'contain', bitrate: step.bitrate, forceTranscode: true}});
      if (!conversion.isValid) return original();
      conversion.onProgress = p => onProgress?.((index + p) / VIDEO_STEPS.length);
      await conversion.execute();
      const buffer = target.buffer;
      if (buffer && buffer.byteLength <= MAX_STORED_VIDEO_BYTES) {
        onProgress?.(1);
        return {blob: new Blob([buffer], {type: 'video/mp4'}), type: 'video/mp4', extension: 'mp4'};
      }
    }
    throw new Error('This video is still too large after shrinking. Choose a shorter clip.');
  } finally {
    input.dispose();
  }
}

/** Reads a chosen video's length via the browser; NaN when it cannot tell (checked again during conversion). */
export function readVideoDuration(file: File, timeoutMs = 4000): Promise<number> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file), video = document.createElement('video');
    const done = (seconds: number) => { clearTimeout(timer); URL.revokeObjectURL(url); video.removeAttribute('src'); resolve(seconds); };
    const timer = setTimeout(() => done(NaN), timeoutMs);
    video.preload = 'metadata';
    video.onloadedmetadata = () => done(video.duration);
    video.onerror = () => done(NaN);
    video.src = url;
  });
}
