import { useEffect, useId, useRef, useState } from '../../vendor/preact-hooks.mjs';
import { html } from './html.js';
import { Icon } from './icons.js';
import { canHover } from './haptics.js';

/*
 * Gemello digitale della T-Cross: SVG vettoriale disegnato a mano, vista 3/4 anteriore.
 * Layer: ombra a terra, carrozzeria metallizzata, cofano, linea di cintura, vetri con riflesso,
 * cerchi a razze, fari LED con alone champagne, barre portapacchi, specchietto, luce radente animata.
 * Se esiste app/assets/tcross.jpg viene mostrata la foto al posto della sagoma (D8).
 */

/** Tinte della carrozzeria (dal chiaro allo scuro) in base al colore dichiarato. */
const PAINTS = {
  grigio: ['#DADDE3', '#AEB2BA', '#82868E', '#5E6168', '#3A3C42'],
  bianco: ['#FFFFFF', '#ECEEF1', '#CDD0D6', '#A7AAB1', '#7D8087'],
  nero: ['#6B6E75', '#3F4147', '#26272C', '#18191C', '#0D0D0F'],
  rosso: ['#FF8A80', '#E0473C', '#B32A22', '#861B16', '#4F0E0B'],
  blu: ['#9CC2FF', '#4D86E0', '#2A5DB0', '#1B3F7C', '#0E2147'],
  argento: ['#F1F2F5', '#CACDD3', '#A3A7AE', '#7B7F86', '#55585E'],
};

export function paintFor(color) {
  const c = String(color || '').toLowerCase();
  const key = Object.keys(PAINTS).find((k) => c.includes(k)) || (c.includes('bianc') ? 'bianco' : 'grigio');
  return PAINTS[key];
}

/* ---------- Foto opzionale ---------- */
let photoPromise = null;
/**
 * URL della foto se app/assets/tcross.jpg esiste. Il controllo passa dal service worker,
 * che risponde 204 quando il file manca: così la console resta pulita.
 */
function detectPhoto() {
  if (!photoPromise) {
    photoPromise = (async () => {
      if (!navigator.serviceWorker?.controller) return null;
      try {
        const res = await fetch('./assets/tcross.jpg', { cache: 'no-cache' });
        if (res.status !== 200 || !(res.headers.get('content-type') || '').startsWith('image/')) return null;
        return URL.createObjectURL(await res.blob());
      } catch {
        return null;
      }
    })();
  }
  return photoPromise;
}

/* ---------- Parallax ---------- */
const clamp = (v) => Math.max(-1, Math.min(1, v));
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOTION_KEY = 'nexuslife.twinMotion';

function readMotionPref() {
  try { return localStorage.getItem(MOTION_KEY) === '1'; } catch { return false; }
}
function saveMotionPref() {
  try { localStorage.setItem(MOTION_KEY, '1'); } catch { /* archivio del browser non disponibile */ }
}

function useParallax(ref) {
  const [needsPermission, setNeedsPermission] = useState(false);
  const frame = useRef(0);

  const apply = (x, y) => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      ref.current?.style.setProperty('--px', x.toFixed(3));
      ref.current?.style.setProperty('--py', y.toFixed(3));
    });
  };

  const onOrientation = (e) => {
    if (e.gamma === null || e.beta === null) return;
    apply(clamp(e.gamma / 30), clamp((e.beta - 45) / 30));
  };

  const listen = () => window.addEventListener('deviceorientation', onOrientation);

  useEffect(() => {
    if (reducedMotion() || canHover || typeof DeviceOrientationEvent === 'undefined') return undefined;
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS: serve un consenso esplicito, chiesto con un tocco
      if (readMotionPref()) {
        DeviceOrientationEvent.requestPermission().then((r) => (r === 'granted' ? listen() : setNeedsPermission(true)))
          .catch(() => setNeedsPermission(true));
      } else {
        setNeedsPermission(true);
      }
    } else {
      listen();
    }
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      cancelAnimationFrame(frame.current);
    };
  }, []);

  const requestMotion = async () => {
    try {
      if ((await DeviceOrientationEvent.requestPermission()) === 'granted') {
        saveMotionPref();
        setNeedsPermission(false);
        listen();
      }
    } catch {
      setNeedsPermission(false);
    }
  };

  const onPointerMove = (e) => {
    if (!canHover || reducedMotion() || e.pointerType === 'touch' || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    apply(clamp(((e.clientX - r.left) / r.width) * 2 - 1), clamp(((e.clientY - r.top) / r.height) * 2 - 1));
  };
  const onPointerLeave = () => apply(0, 0);

  return { needsPermission, requestMotion, onPointerMove, onPointerLeave };
}

/* ---------- Disegno ---------- */
const BODY = 'M92 128C120 120 140 116 168 112L210 74C214 70 220 68 228 68L346 67C356 67 362 70 366 76L392 110C398 118 400 126 400 136L401 176C401 188 394 194 384 194L376 194A42 42 0 0 0 292 194L170 195A42 42 0 0 0 86 195L88 192C86 170 88 148 92 128Z';
const FRONT = 'M92 128C80 129 58 132 46 136C38 139 34 146 34 156L34 184C34 192 40 196 48 197L88 196C86 170 88 148 92 128Z';
const HOOD = 'M46 136L92 128L168 112L156 104C120 110 72 120 42 130C40 132 42 135 46 136Z';

function Wheel({ cx, cy, id }) {
  const spokes = [0, 72, 144, 216, 288];
  return html`
    <g class="twin__wheel">
      <circle cx=${cx} cy=${cy} r="34" fill="#0F0F12" />
      <circle cx=${cx} cy=${cy} r="31" fill="none" stroke="#25262B" stroke-width="2" />
      <circle cx=${cx} cy=${cy} r="24" fill=${`url(#${id}-rim)`} />
      ${spokes.map((a) => html`<path key=${a} transform=${`rotate(${a} ${cx} ${cy})`}
        d=${`M${cx - 3.2} ${cy - 5}L${cx - 5.5} ${cy - 22}L${cx + 5.5} ${cy - 22}L${cx + 3.2} ${cy - 5}Z`}
        fill="#E6E8EC" opacity=".92" />`)}
      <circle cx=${cx} cy=${cy} r="24" fill="none" stroke="#3A3C42" stroke-width="1.5" />
      <circle cx=${cx} cy=${cy} r="6" fill="#2A2C31" stroke="#C7CAD1" stroke-width="1.2" />
    </g>`;
}

function TwinSvg({ color, label }) {
  const uid = `tw${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const p = paintFor(color);
  return html`
    <svg class="twin__svg" viewBox="0 0 440 240" role="img" aria-label=${label}>
      <defs>
        <linearGradient id=${`${uid}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color=${p[0]} /><stop offset=".32" stop-color=${p[1]} />
          <stop offset=".55" stop-color=${p[2]} /><stop offset=".8" stop-color=${p[3]} /><stop offset="1" stop-color=${p[4]} />
        </linearGradient>
        <linearGradient id=${`${uid}-front`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color=${p[3]} /><stop offset="1" stop-color=${p[2]} />
        </linearGradient>
        <linearGradient id=${`${uid}-hood`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stop-color=${p[1]} /><stop offset="1" stop-color=${p[0]} />
        </linearGradient>
        <linearGradient id=${`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#2B3240" /><stop offset=".5" stop-color="#11141B" /><stop offset="1" stop-color="#07080B" />
        </linearGradient>
        <linearGradient id=${`${uid}-reflect`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#fff" stop-opacity="0" /><stop offset=".5" stop-color="#fff" stop-opacity=".22" />
          <stop offset="1" stop-color="#fff" stop-opacity="0" />
        </linearGradient>
        <radialGradient id=${`${uid}-rim`}>
          <stop offset="0" stop-color="#5C5F66" /><stop offset=".7" stop-color="#2A2C31" /><stop offset="1" stop-color="#8E9196" />
        </radialGradient>
        <radialGradient id=${`${uid}-halo`}>
          <stop offset="0" stop-color="#F2E3C2" stop-opacity=".9" /><stop offset=".4" stop-color="#D9BF8C" stop-opacity=".35" />
          <stop offset="1" stop-color="#D9BF8C" stop-opacity="0" />
        </radialGradient>
        <linearGradient id=${`${uid}-sweep`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#fff" stop-opacity="0" /><stop offset=".5" stop-color="#fff" stop-opacity=".45" />
          <stop offset="1" stop-color="#fff" stop-opacity="0" />
        </linearGradient>
        <filter id=${`${uid}-blur`} x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="7" /></filter>
        <clipPath id=${`${uid}-clip`}><path d=${BODY} /><path d=${FRONT} /><path d=${HOOD} /></clipPath>
      </defs>

      <!-- 1. Ombra a terra -->
      <g class="twin__shadow">
        <ellipse cx="220" cy="222" rx="200" ry="12" fill="#000" opacity=".7" filter=${`url(#${uid}-blur)`} />
        <ellipse cx="128" cy="224" rx="40" ry="5" fill="#000" opacity=".8" />
        <ellipse cx="334" cy="223" rx="40" ry="5" fill="#000" opacity=".8" />
      </g>

      <g class="twin__car">
        <!-- 2. Barre portapacchi -->
        <path d="M226 64L346 62" stroke="#1B1C20" stroke-width="5" stroke-linecap="round" />
        <path d="M226 62.5L346 60.5" stroke="#8E9196" stroke-width="1" stroke-linecap="round" opacity=".7" />
        <path d="M236 64v4M336 62.5v4.5" stroke="#1B1C20" stroke-width="4" />

        <!-- 3. Carrozzeria -->
        <path d=${FRONT} fill=${`url(#${uid}-front)`} />
        <path d=${BODY} fill=${`url(#${uid}-body)`} />
        <path d=${HOOD} fill=${`url(#${uid}-hood)`} />

        <!-- 4. Vetri scuri con riflesso -->
        <path d="M168 112L210 74L198 72L156 104Z" fill=${`url(#${uid}-glass)`} />
        <path d="M180 112L214 79C216 76 219 75 223 75L340 74C347 74 351 76 355 81L377 108C379 111 378 113 374 113Z" fill=${`url(#${uid}-glass)`} />
        <path d="M262 75h7l-2 38h-7Z M328 74h9l12 39h-12Z" fill="#0A0B0E" />
        <path d="M196 98L222 78L250 78L214 106Z" fill=${`url(#${uid}-reflect)`} />

        <!-- 5. Linea di cintura e nervature -->
        <path d="M168 115L388 117" stroke="#fff" stroke-opacity=".35" stroke-width="1.2" fill="none" />
        <path d="M100 142C200 136 300 136 399 142" stroke="#fff" stroke-opacity=".22" stroke-width="1" fill="none" />
        <path d="M265 117L263 186M338 118L340 184" stroke="#000" stroke-opacity=".28" stroke-width="1" />
        <path d="M232 130h16M306 130h16" stroke="#1B1C20" stroke-width="2.5" stroke-linecap="round" />

        <!-- 6. Paraurti, griglia e protezioni passaruota -->
        <path d="M38 160L87 153L87 170L38 175Z" fill="#141519" />
        <path d="M41 164L86 158M41 168.5L86 163" stroke="#3A3C42" stroke-width="1" />
        <path d="M34 178L88 179L88 196L48 197C40 196 34 192 34 184Z" fill="#1B1C20" />
        <path d="M170 195L292 194L292 186L170 188Z" fill="#1B1C20" />
        <path d="M86 195A42 42 0 0 1 170 195" fill="none" stroke="#1B1C20" stroke-width="7" />
        <path d="M292 194A42 42 0 0 1 376 194" fill="none" stroke="#1B1C20" stroke-width="7" />
        <path d="M392 120L400 122L400 132L393 130Z" fill="#B3261E" />

        <!-- 7. Specchietto -->
        <path d="M180 112C176 104 182 100 190 101L199 103C201 108 197 113 189 114Z" fill=${`url(#${uid}-front)`} stroke="#1B1C20" stroke-width=".8" />

        <!-- 8. Fari LED con alone champagne -->
        <ellipse class="twin__halo" cx="64" cy="146" rx="46" ry="16" fill=${`url(#${uid}-halo)`} />
        <path d="M40 142L88 134L90 146L42 152Z" fill="#0C0D10" />
        <path d="M92 132L114 127L112 136L91 140Z" fill="#0C0D10" />
        <path class="twin__led" d="M44 147L87 140M93 136L110 132" stroke="#F2E3C2" stroke-width="2" stroke-linecap="round" />

        <!-- 9. Cerchi a razze -->
        <${Wheel} cx=${128} cy=${190} id=${uid} />
        <${Wheel} cx=${334} cy=${190} id=${uid} />

        <!-- 10. Luce radente animata -->
        <g clip-path=${`url(#${uid}-clip)`}>
          <rect class="twin__sweep" x="-120" y="40" width="90" height="180" fill=${`url(#${uid}-sweep)`} transform="skewX(-18)" />
        </g>
      </g>
    </svg>`;
}

/**
 * @param {{ color?: string, label: string, children?: any }} props
 */
export function DigitalTwin({ color, label }) {
  const ref = useRef(null);
  const [photo, setPhoto] = useState(null);
  const { needsPermission, requestMotion, onPointerMove, onPointerLeave } = useParallax(ref);

  useEffect(() => {
    let alive = true;
    detectPhoto().then((url) => { if (alive) setPhoto(url); });
    return () => { alive = false; };
  }, []);

  return html`
    <div class="twin" ref=${ref} onPointerMove=${onPointerMove} onPointerLeave=${onPointerLeave}>
      <div class="twin__stage">
        ${photo
          ? html`<img class="twin__photo" src=${photo} alt=${label} />`
          : html`<${TwinSvg} color=${color} label=${label} />`}
      </div>
      ${needsPermission && html`
        <button class="icon-btn twin__motion" type="button" onClick=${requestMotion} aria-label="Attiva l'effetto movimento">
          <${Icon} name="sparkle" />
        </button>`}
    </div>`;
}
