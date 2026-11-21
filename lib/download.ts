/** Saves a stored photograph or video under its title, in its original quality. */
export async function downloadMedia(url: string, title: string) {
  const name = (title.trim() || 'lichtraum-picture').replace(/[^\p{L}\p{N} _-]+/gu, '').trim().replace(/\s+/g, '-').slice(0, 80) || 'lichtraum-picture';
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('download failed');
    const blob = await response.blob();
    const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' } as Record<string, string>)[blob.type] ?? 'jpg';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${name}.${extension}`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  } catch {
    // Storage links can also ask the server to send the file as a download.
    const fallback = new URL(url);
    fallback.searchParams.set('download', name);
    window.open(fallback.toString(), '_blank', 'noopener');
  }
}
