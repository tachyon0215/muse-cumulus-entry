// Cumulus Courier — shared tuning constants. Everything the flight model,
// the course builder and the renderer agree on lives here so the numbers
// stay in one place.

/** Fixed simulation step, seconds. The world only ever advances by this. */
export const STEP = 1 / 60;

/** localStorage key for the best score. */
export const BEST_KEY = 'cumulus-courier-best-v1';

/** Course length in metres: the runway threshold sits this far ahead. */
export const COURSE_LENGTH = 9200;

/** Height of the runway island's strip above the sea, metres. */
export const RUNWAY_ALTITUDE = 12;

/** Sea level is altitude 0; the plane may not cruise above this ceiling. */
export const CEILING = 900;

/** Flight model limits. */
export const PLANE = {
  minSpeed: 26, // m/s, below this the wing stalls and the nose drops
  maxSpeed: 88, // m/s at full throttle in level flight
  throttleRate: 0.45, // throttle units per second at full key press
  accel: 14, // m/s^2 of speed change at full throttle difference
  pitchRate: 0.9, // rad/s of pitch change at full elevator
  bankRate: 1.6, // rad/s of bank change at full aileron
  maxBank: 0.95, // rad
  turnRate: 0.55, // rad/s of heading change at full bank
  lift: 26, // m/s of climb at pitch up and cruise speed
};

/** Scoring. */
export const SCORE = {
  ringCentre: 150, // flown through within a quarter of the ring radius
  ringEdge: 60, // clipped the ring but still counted
  ringMiss: 0,
  landingPerfect: 500,
  landingFirm: 250,
  perSecondLeft: 5, // time bonus multiplier on a landing
};
