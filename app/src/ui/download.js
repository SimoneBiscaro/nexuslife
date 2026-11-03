import { canHover } from './haptics.js';

/**
 * Salva un file: su iPhone/iPad usa il foglio di condivisione ("Salva su File") quando
 * disponibile, altrimenti un link di download.
 * @returns {Promise<'shared'|'downloaded'|'cancelled'>}
 */
export async function saveFile(blob, filename, { share = true } = {}) {
  if (share && !canHover && typeof navigator.share === 'function' && typeof File === 'function') {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return 'shared';
      } catch (err) {
        if (err?.name === 'AbortError') return 'cancelled';
        // condivisione non riuscita: si ripiega sul download
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}
