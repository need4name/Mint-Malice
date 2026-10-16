// Detection maths shared by the counter, ScamBay and live breaks.
import { SETS } from './data.js';
import { clamp, hasUpg } from './state.js';

// Chance a resealed pack is spotted. q = crimp quality 0-100.
export function resealRisk(base, q, short = false) {
  return clamp(base * (1.6 - (q / 100) * 1.3) * (short ? 1.5 : 1), 0.005, 0.97);
}

// Chance a forgery is spotted. Grades follow the GDD quality tiers.
export function forgeryRisk(base, grade) {
  if (grade < 65) return 1; // immediate failure
  let m;
  if (grade >= 90) m = 0.12; // passes elite collector & grading house inspection
  else m = (base >= 0.5 ? 1 : 0.5) * (1.4 - ((grade - 65) / 25) * 0.6); // fools casuals, collectors suspicious
  if (hasUpg('hustle3') && base >= 0.5) m *= 0.5;
  return clamp(base * m, 0.005, 0.97);
}

export const comboRisk = ps => 1 - ps.reduce((acc, p) => acc * (1 - p), 1);

export function gaslightChance(arch, line) {
  const pro = arch === 'sweat' || arch === 'streamer';
  const boost = hasUpg('hustle1') ? 0.2 : 0;
  if (line === 'misprint') return (arch === 'sweat' ? 0.45 : 0.3) + boost;
  if (line === 'scale') return (pro ? 0.25 : 0.5) + boost;
  if (line === 'factory') return (pro ? 0.25 : 0.55) + boost;
  return 0.3;
}

export function riskLabel(p) {
  if (p <= 0) return 'No risk';
  if (p >= 1) return 'Certain fail';
  return `${Math.max(1, Math.round(p * 100))}% risk`;
}
export const riskClass = p => (p <= 0 ? 'none' : p < 0.1 ? 'low' : p < 0.35 ? 'mid' : 'high');

// Random chase card from a set, cheap cards far more common than grails.
export function pickHit(set) {
  const hits = SETS[set].hits;
  const w = hits.map(h => 1 / Math.pow(h.value, 0.9));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < hits.length; i++) { r -= w[i]; if (r <= 0) return hits[i]; }
  return hits[0];
}
