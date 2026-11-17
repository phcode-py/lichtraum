-- PREPARED ONLY. Review separately; no stored file is deleted or overwritten.
-- Allows new video references in the existing private paper-reference bucket.
update storage.buckets set file_size_limit=52428800,
 allowed_mime_types=array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime']
 where id='paper-references';
-- Existing owner upload / accessible-note read policies remain in place.
