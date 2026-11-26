// Cumulus Courier — the screenshot scenes behind ?shot=start|play|rings|land.
// Each scene flies the real flight model forward from a fresh world, steered
// by a simple autopilot that chases the next ring (and, for the landing
// scene, lines up on the runway and descends), so every frame is a frame a
// player could reach, and the same seed always gives the same frame.

import { COURSE_LENGTH, RUNWAY_ALTITUDE, STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** A pilot that aims at a target point: bank toward it, pitch toward its height. */
function autopilotControl(state, target) {
  const plane = state.plane;
  const wantedHeading = Math.atan2(target.x - plane.x, target.z - plane.z);
  let headingError = wantedHeading - plane.heading;
  while (headingError > Math.PI) headingError -= Math.PI * 2;
  while (headingError < -Math.PI) headingError += Math.PI * 2;
  const bank = clamp(headingError * 1.6 - plane.bank * 0.6, -1, 1);
  const heightError = target.y - plane.y;
  const pitch = clamp(heightError * 0.012 - plane.pitch * 0.7, -1, 1);
  const throttle = target.throttle === undefined ? 0 : clamp(target.throttle - plane.throttle, -1, 1) * 2;
  return { pitch, bank, throttle };
}

function nextRing(state) {
  return state.rings.find((ring) => ring.state === 'waiting');
}

function flySeconds(world, seconds, targetOf) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const target = targetOf(world.state);
    if (!target) break;
    world.step(STEP, autopilotControl(world.state, target));
    if (world.state.over) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Scenes: start (title over the island chain), play (cruising the ring
 * line), rings (closing on a glowing ring), land (on final for the runway).
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name === 'play') {
    flySeconds(world, 13, (s) => nextRing(s) ?? { x: 0, y: 150, z: COURSE_LENGTH });
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'rings') {
    // Fly until a ring is a few hundred metres ahead, then freeze the chase.
    for (let i = 0; i < 60 / STEP; i += 1) {
      const ring = nextRing(state);
      if (!ring) break;
      if (ring.z - state.plane.z < 300 && i > 40) break;
      world.step(STEP, autopilotControl(state, ring));
      if (state.over) break;
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'land') {
    // Jump to a stabilised final: lined up on the runway, descending gently.
    const plane = state.plane;
    plane.x = 4;
    plane.y = 58;
    plane.z = COURSE_LENGTH - 520;
    plane.heading = 0;
    plane.speed = 38;
    plane.throttle = 0.3;
    flySeconds(world, 3.5, () => ({ x: 0, y: RUNWAY_ALTITUDE + 30, z: COURSE_LENGTH + 120, throttle: 0.28 }));
    return { screen: SCREEN_PLAY, best: 0 };
  }
  // start: idle on the title, the island chain ahead.
  flySeconds(world, 2, () => ({ x: 0, y: 165, z: COURSE_LENGTH, throttle: 0.55 }));
  return { screen: SCREEN_TITLE, best: 0 };
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
