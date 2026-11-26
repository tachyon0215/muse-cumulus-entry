// Cumulus Courier — the world: one courier plane, a chain of islands in a
// wide sea, a line of glowing rings to fly through, and a runway on the far
// island. Coordinates are metres: x is east, z is distance flown north from
// the start, y is altitude above the sea. The plane's own frame is what the
// renderer projects; the world itself is plain numbers, stepped at a fixed
// rate, so a seed always flies the same course.

import { CEILING, COURSE_LENGTH, PLANE, RUNWAY_ALTITUDE, SCORE } from './config.js';
import { randomRange } from './random.js';

export const EVENT_RING = 1; // passed through a ring
export const EVENT_RING_MISSED = 2; // a ring went by unflown
export const EVENT_LANDED = 4; // touched down on the runway
export const EVENT_CRASHED = 8; // hit the sea, an island or the ground hard
export const EVENT_OVERSHOT = 16; // crossed the island without landing

const RING_COUNT = 9;
const RING_RADIUS = 26;
const ISLAND_COUNT = 26;

/** One island: a soft cone of land rising out of the sea. */
function makeIsland(nextRandom, z, spread) {
  return {
    x: randomRange(nextRandom, -spread, spread),
    z,
    radius: randomRange(nextRandom, 180, 460),
    height: randomRange(nextRandom, 26, 130),
    hueShift: nextRandom(),
  };
}

/** The ring line: gates hung in the air along the course, drifting wider as they go. */
function makeRings(nextRandom) {
  const rings = [];
  let x = 0;
  let y = 150;
  for (let index = 0; index < RING_COUNT; index += 1) {
    const z = 900 + index * ((COURSE_LENGTH - 1900) / (RING_COUNT - 1));
    x = Math.max(-420, Math.min(420, x + randomRange(nextRandom, -190, 190)));
    y = Math.max(70, Math.min(420, y + randomRange(nextRandom, -70, 70)));
    rings.push({ x, y, z, radius: RING_RADIUS, state: 'waiting' });
  }
  return rings;
}

export function createWorld(nextRandom) {
  const islands = [];
  for (let index = 0; index < ISLAND_COUNT; index += 1) {
    const island = makeIsland(nextRandom, (index / ISLAND_COUNT) * COURSE_LENGTH + randomRange(nextRandom, -120, 120), 700);
    // Keep the final approach corridor clear: no peaks beside the runway run-in.
    if (island.z > COURSE_LENGTH - 1700 && Math.abs(island.x) < 560) {
      island.x = (island.x < 0 ? -1 : 1) * randomRange(nextRandom, 580, 820);
    }
    islands.push(island);
  }
  // The home island behind the start and the runway island at the end are fixed.
  islands.push({ x: 0, z: -260, radius: 520, height: RUNWAY_ALTITUDE, hueShift: 0.4 });
  islands.push({ x: 0, z: COURSE_LENGTH + 260, radius: 640, height: RUNWAY_ALTITUDE, hueShift: 0.6 });

  const state = {
    time: 0,
    plane: null,
    rings: makeRings(nextRandom),
    islands,
    ringsFlown: 0,
    score: 0,
    message: '',
    messageTime: 0,
    over: false,
    landed: false,
  };

  function reset() {
    state.time = 0;
    // A fresh ring line each flight: the generator has moved on since the
    // islands were drawn, so a restart is a new course over the same chain.
    state.rings = makeRings(nextRandom);
    state.ringsFlown = 0;
    state.score = 0;
    state.message = '';
    state.messageTime = 0;
    state.over = false;
    state.landed = false;
    state.plane = {
      x: 0,
      y: 165,
      z: 0,
      heading: 0, // rad, 0 = straight down the course (+z)
      pitch: 0, // rad, positive = nose up
      bank: 0, // rad, positive = right wing down
      speed: 46, // m/s
      throttle: 0.55,
      verticalSpeed: 0,
    };
  }

  /** Ground height under a point: the tallest island cone there, or the sea. */
  function groundAt(x, z) {
    let ground = 0;
    for (const island of state.islands) {
      const dx = x - island.x;
      const dz = z - island.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < island.radius) {
        const h = island.height * (1 - dist / island.radius);
        if (h > ground) ground = h;
      }
    }
    return ground;
  }

  /**
   * Advance the world one fixed step. `control` is
   * { pitch: -1..1, bank: -1..1, throttle: -1..1 } from the input layer.
   * Returns the event flags raised this step.
   */
  function step(dt, control) {
    if (state.over) return 0;
    let events = 0;
    const plane = state.plane;
    state.time += dt;

    plane.throttle = clamp(plane.throttle + control.throttle * PLANE.throttleRate * dt, 0, 1);
    plane.bank = clamp(plane.bank + control.bank * PLANE.bankRate * dt, -PLANE.maxBank, PLANE.maxBank);
    if (control.bank === 0) plane.bank *= Math.pow(0.4, dt); // wings level themselves slowly
    plane.pitch = clamp(plane.pitch + control.pitch * PLANE.pitchRate * dt, -0.5, 0.55);
    if (control.pitch === 0) plane.pitch *= Math.pow(0.55, dt);

    // Speed chases what the throttle and the slope of the flight ask for.
    const targetSpeed = PLANE.minSpeed + plane.throttle * (PLANE.maxSpeed - PLANE.minSpeed) - plane.pitch * 34;
    plane.speed += clamp(targetSpeed - plane.speed, -PLANE.accel * dt, PLANE.accel * dt);

    // A stalled wing drops the nose and the plane sinks.
    const stalled = plane.speed < PLANE.minSpeed + 3;
    const liftFactor = stalled ? 0.35 : clamp((plane.speed - PLANE.minSpeed) / 22, 0.25, 1);
    plane.verticalSpeed = plane.pitch * PLANE.lift * liftFactor - (stalled ? 9 : 1.6);
    plane.heading += Math.sin(plane.bank) * PLANE.turnRate * dt * (plane.speed / 46);

    plane.x += Math.sin(plane.heading) * plane.speed * dt;
    plane.z += Math.cos(plane.heading) * plane.speed * dt;
    plane.y = clamp(plane.y + plane.verticalSpeed * dt, 0, CEILING);

    events |= scoreRings(plane);
    events |= checkGround(plane);
    if (state.messageTime > 0) state.messageTime -= dt;
    return events;
  }

  function scoreRings(plane) {
    let events = 0;
    for (const ring of state.rings) {
      if (ring.state !== 'waiting') continue;
      if (plane.z < ring.z) continue;
      const dx = plane.x - ring.x;
      const dy = plane.y - ring.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= ring.radius * 0.45) {
        ring.state = 'flown';
        state.score += SCORE.ringCentre;
        state.ringsFlown += 1;
        state.message = `Ring ${state.ringsFlown} — dead centre +${SCORE.ringCentre}`;
        events |= EVENT_RING;
      } else if (dist <= ring.radius) {
        ring.state = 'flown';
        state.score += SCORE.ringEdge;
        state.ringsFlown += 1;
        state.message = `Ring ${state.ringsFlown} — clipped it +${SCORE.ringEdge}`;
        events |= EVENT_RING;
      } else {
        ring.state = 'missed';
        state.message = 'Ring missed';
        events |= EVENT_RING_MISSED;
      }
      state.messageTime = 2.2;
    }
    return events;
  }

  function checkGround(plane) {
    const onRunwayStrip =
      plane.z > COURSE_LENGTH - 60 && plane.z < COURSE_LENGTH + 420 && Math.abs(plane.x) < 34;
    const ground = onRunwayStrip ? RUNWAY_ALTITUDE : groundAt(plane.x, plane.z);
    if (plane.y > ground + 2) {
      if (plane.z > COURSE_LENGTH + 460 && !state.landed) {
        state.over = true;
        state.message = 'You flew past the island — no landing.';
        return EVENT_OVERSHOT;
      }
      return 0;
    }
    // Touching the surface: a landing only on the strip, slow and gentle.
    if (onRunwayStrip && plane.speed < 44 && plane.verticalSpeed > -6.5) {
      state.landed = true;
      state.over = true;
      const gentle = plane.verticalSpeed > -3.2 && plane.speed < 37;
      const bonus = gentle ? SCORE.landingPerfect : SCORE.landingFirm;
      state.score += bonus + Math.max(0, Math.round((150 - state.time) * SCORE.perSecondLeft));
      state.message = gentle ? `Silky touchdown! +${bonus}` : `Firm arrival. +${bonus}`;
      return EVENT_LANDED;
    }
    state.over = true;
    state.message = onRunwayStrip
      ? 'Too fast, too hard — the courier cartwheeled.'
      : 'The flight ended in the terrain.';
    return EVENT_CRASHED;
  }

  reset();
  return { state, step, reset, groundAt };
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
