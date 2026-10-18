// Persisted player settings (graphics, audio, comfort, controls).
const KEY = 'ff-settings';
export const VERSION = '1.0.0';

const mobile = /Android|iPhone|iPad|Quest|OculusBrowser|Pico/i.test(navigator.userAgent);
const DEFAULTS = {
  quality: mobile ? 'medium' : ((navigator.hardwareConcurrency || 4) >= 8 ? 'high' : 'medium'),
  ao: true, bloom: true, flare: true,
  volume: 0.7, ambience: true, engine: true,
  snapAngle: 30, turnMode: 'snap', locomotion: 'both', seatedOffset: 0,
  invertPitch: false, reduceMotion: false, showHints: true,
};

export const QUALITY = {
  low: { label: 'Low', pixelRatio: 1, shadow: 1024, post: false, ao: false, trees: 0.45, terrainSeg: 200, smaa: false },
  medium: { label: 'Medium', pixelRatio: 1.25, shadow: 2048, post: true, ao: false, trees: 0.7, terrainSeg: 260, smaa: true },
  high: { label: 'High', pixelRatio: 1.75, shadow: 4096, post: true, ao: true, trees: 1, terrainSeg: 360, smaa: true },
  ultra: { label: 'Ultra', pixelRatio: 2, shadow: 4096, post: true, ao: true, trees: 1.3, terrainSeg: 440, smaa: true },
};

export const settings = (() => {
  let s;
  try { s = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { s = { ...DEFAULTS }; }
  if (!QUALITY[s.quality]) s.quality = DEFAULTS.quality;
  return s;
})();

const listeners = new Set();
export function onSettings(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function setSetting(key, value) {
  settings[key] = value;
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* storage blocked */ }
  listeners.forEach(fn => fn(key, value));
}
export function resetSettings() { Object.keys(DEFAULTS).forEach(k => setSetting(k, DEFAULTS[k])); }
export const quality = () => QUALITY[settings.quality];
