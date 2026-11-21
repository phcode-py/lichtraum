// One policy for every video upload (atlas, walk impressions, working notes, correspondence).
// The browser converts the chosen original to an H.264 MP4 of at most 1080p before upload, so it plays
// in every browser and fits the 50 MB Supabase limit (Free plan cap).
/** Largest original a person can choose; it is converted before upload. */
export const MAX_VIDEO_INPUT_BYTES = 1024 * 1024 * 1024;
/** Largest stored video (videos + paper-references buckets, Supabase Free plan limit). */
export const MAX_STORED_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 60;

/** Output steps, tried in order until the file fits: 1080p first, 720p if a clip is still too large. */
export const VIDEO_STEPS = [
  {longEdge: 1920, shortEdge: 1080, bitrate: 5_000_000},
  {longEdge: 1280, shortEdge: 720, bitrate: 2_500_000},
] as const;

/** Fits a video into the step's box without enlarging it; H.264 needs even dimensions. */
export function videoSize(width: number, height: number, step: {longEdge: number; shortEdge: number} = VIDEO_STEPS[0]) {
  const long = Math.max(width, height), short = Math.min(width, height);
  const scale = Math.min(1, step.longEdge / long, step.shortEdge / short);
  const even = (n: number) => Math.max(2, Math.round(n * scale / 2) * 2);
  return {width: even(width), height: even(height)};
}

/** Small tolerance: phones often report 60.02 s for a one-minute clip. */
export const videoDurationError = (seconds: number) =>
  Number.isFinite(seconds) && seconds > MAX_VIDEO_SECONDS + 0.5 ? 'Choose a video up to 1 minute long.' : '';

export const storedVideoOk = (file: {size: number}) => Number.isFinite(file.size) && file.size > 0 && file.size <= MAX_STORED_VIDEO_BYTES;
