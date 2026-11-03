/** Feedback aptico leggero dove supportato (su iOS non esiste: nessun effetto). */
export function haptic(ms = 10) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms);
  } catch {
    /* alcuni browser lanciano se la pagina non ha ancora ricevuto un gesto */
  }
}

/** true se il dispositivo ha un puntatore capace di hover (mouse, trackpad). */
export const canHover = typeof matchMedia === 'function' && matchMedia('(hover: hover)').matches;
