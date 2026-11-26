// A small deterministic random generator (mulberry32). A seed fixes the
// whole island chain and ring line, so a screenshot scene or a replayed
// flight is always the same flight.

export function createRandom(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random float in [min, max). */
export function randomRange(nextRandom, min, max) {
  return min + nextRandom() * (max - min);
}

/** Random integer in [min, max]. */
export function randomInt(nextRandom, min, max) {
  return min + Math.floor(nextRandom() * (max - min + 1));
}
