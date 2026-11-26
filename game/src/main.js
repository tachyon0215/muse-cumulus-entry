// Cumulus Courier — boot and the one loop. Input is read every frame, the
// world advances in fixed 1/60 s steps (several in a slow frame, none in a
// fast one), and the renderer paints what is there. Screens: title, play,
// paused and over (landed or otherwise).
//
// ?seed=N fixes the island chain and ring line. ?shot=start|play|rings|land
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25; // longest frame the loop catches up on

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit.
  }
}

function announce(text) {
  if (status) status.textContent = text;
}

if (shot) {
  const scene = stageShot(shot, world);
  let painted = 0;
  const paint = () => {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  };
  requestAnimationFrame(paint);
} else {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let lastMessage = '';

  function frame(now) {
    const elapsed = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    for (const action of input.takeActions()) {
      if (action === ACTION_CONFIRM) {
        if (screen === SCREEN_TITLE) {
          screen = SCREEN_PLAY;
          announce('Takeoff. Fly through the rings and land on the far runway.');
        } else if (screen === SCREEN_OVER) {
          world.reset();
          screen = SCREEN_PLAY;
        } else if (screen === SCREEN_PAUSED) {
          screen = SCREEN_PLAY;
        }
      } else if (action === ACTION_PAUSE) {
        if (screen === SCREEN_PLAY) screen = SCREEN_PAUSED;
        else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
      }
    }
    if (screen === SCREEN_PLAY) {
      accumulator += elapsed;
      const control = input.read(canvas.clientWidth, canvas.clientHeight);
      while (accumulator >= STEP) {
        world.step(STEP, control);
        accumulator -= STEP;
        if (world.state.over) {
          screen = SCREEN_OVER;
          if (world.state.score > best) {
            best = world.state.score;
            saveBest(best);
          }
          announce(world.state.message);
          break;
        }
      }
      if (world.state.message && world.state.message !== lastMessage) {
        lastMessage = world.state.message;
        announce(lastMessage);
      }
    }
    renderer.draw(world.state, screen, best);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
