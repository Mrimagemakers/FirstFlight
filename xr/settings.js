// Persisted player settings (graphics, audio, comfort, controls).
const KEY = 'ff-settings';
export const VERSION = '1.0.0';

const mobile = /Android|iPhone|iPad|Quest|OculusBrowser|Pico/i.test(navigator.userAgent);
const DEFAULTS = {
  quality: null, // filled in below from the graphics card
  ao: true, bloom: true, flare: true,
  volume: 0.7, ambience: true, engine: true,
  snapAngle: 30, turnMode: 'snap', locomotion: 'both', seatedOffset: 0,
  invertPitch: false, reduceMotion: false, showHints: true,
  panelMode: 'hand', teleportFade: true,
};

// pixelRatio/shadow/post/ao/smaa: screen rendering. msaa: multisampled post buffers. anisotropy: texture sharpness.
// xrScale/xrFoveation: VR headset resolution and edge sharpness. water: 'reflect' = real-time reflections.
// terrainHQ: tri-planar rock and detail shading. treeShadows/clouds/trees/terrainSeg: world density.
export const QUALITY = {
  low: { label: 'Low', pixelRatio: 1, shadow: 1024, post: false, ao: false, trees: 0.45, terrainSeg: 200, smaa: false, msaa: 0, anisotropy: 4, xrScale: 1, xrFoveation: 1, water: 'standard', terrainHQ: false, treeShadows: false, clouds: 0.7, aoSamples: 8 },
  medium: { label: 'Medium', pixelRatio: 1.25, shadow: 2048, post: true, ao: false, trees: 0.7, terrainSeg: 260, smaa: true, msaa: 0, anisotropy: 8, xrScale: 1.1, xrFoveation: 0.6, water: 'standard', terrainHQ: false, treeShadows: false, clouds: 0.85, aoSamples: 12 },
  high: { label: 'High', pixelRatio: 1.75, shadow: 4096, post: true, ao: true, trees: 1, terrainSeg: 360, smaa: true, msaa: 0, anisotropy: 12, xrScale: 1.25, xrFoveation: 0.35, water: 'standard', terrainHQ: true, treeShadows: false, clouds: 1, aoSamples: 16 },
  ultra: { label: 'Ultra (powerful graphics card)', pixelRatio: 2, shadow: 4096, post: true, ao: true, trees: 1.6, terrainSeg: 512, smaa: false, msaa: 4, anisotropy: 16, xrScale: 1.5, xrFoveation: 0.1, water: 'reflect', terrainHQ: true, treeShadows: true, clouds: 1.5, aoSamples: 24, reflections: true },
};

/** Best starting quality for this device: Ultra on recognised high-end desktop graphics cards. */
function detectQuality() {
  if (mobile) return 'medium';
  let gpu = '';
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    gpu = (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER)) || '';
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { /* no WebGL */ }
  if (/RTX\s?[2-9]\d{3}|RTX\s?A\d|Radeon\s?RX\s?(6[789]|7[6-9]|9\d)\d\d|Apple M\d (Pro|Max|Ultra)|Arc A7/i.test(gpu)) return 'ultra';
  if (/swiftshader|llvmpipe|software/i.test(gpu)) return 'low';
  return (navigator.hardwareConcurrency || 4) >= 8 ? 'high' : 'medium';
}
export const GPU_DEFAULT = typeof document !== 'undefined' ? detectQuality() : 'medium';

export const settings = (() => {
  let s;
  try { s = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { s = { ...DEFAULTS }; }
  if (!QUALITY[s.quality]) s.quality = GPU_DEFAULT;
  return s;
})();

const listeners = new Set();
export function onSettings(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function setSetting(key, value) {
  settings[key] = value;
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* storage blocked */ }
  listeners.forEach(fn => fn(key, value));
}
export function resetSettings() { Object.keys(DEFAULTS).forEach(k => setSetting(k, k === 'quality' ? GPU_DEFAULT : DEFAULTS[k])); }
export const quality = () => QUALITY[settings.quality];
