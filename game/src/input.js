// Cumulus Courier — input: keyboard flight controls plus a mouse option.
// Arrows (or I/K/J/L) work the stick, W/S or R/F work the throttle, and
// dragging the mouse steers toward the pointer. Enter/Space confirms,
// P or Esc pauses. The layer only reports intent; the world owns the plane.

export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';

const KEYMAP = {
  ArrowUp: 'pitchDown', // pushing the stick forward: nose down
  ArrowDown: 'pitchUp',
  ArrowLeft: 'bankLeft',
  ArrowRight: 'bankRight',
  KeyW: 'throttleUp',
  KeyS: 'throttleDown',
  KeyR: 'throttleUp',
  KeyF: 'throttleDown',
  KeyI: 'pitchDown',
  KeyK: 'pitchUp',
  KeyJ: 'bankLeft',
  KeyL: 'bankRight',
};

export function createInput(canvas) {
  const held = new Set();
  const actions = [];
  let mouse = null; // {x, y} in canvas pixels while the button is held

  function onKeyDown(event) {
    if (KEYMAP[event.code]) {
      held.add(KEYMAP[event.code]);
      event.preventDefault();
    } else if (event.code === 'Enter' || event.code === 'Space') {
      actions.push(ACTION_CONFIRM);
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      actions.push(ACTION_PAUSE);
    }
  }
  function onKeyUp(event) {
    if (KEYMAP[event.code]) held.delete(KEYMAP[event.code]);
  }
  function onPointerDown(event) {
    mouse = { x: event.clientX, y: event.clientY };
    actions.push(ACTION_CONFIRM);
  }
  function onPointerMove(event) {
    if (mouse) mouse = { x: event.clientX, y: event.clientY };
  }
  function onPointerUp() {
    mouse = null;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  return {
    /** The control intent for this frame: each axis in -1..1. */
    read(width, height) {
      const control = { pitch: 0, bank: 0, throttle: 0 };
      if (held.has('pitchUp')) control.pitch += 1;
      if (held.has('pitchDown')) control.pitch -= 1;
      if (held.has('bankLeft')) control.bank -= 1;
      if (held.has('bankRight')) control.bank += 1;
      if (held.has('throttleUp')) control.throttle += 1;
      if (held.has('throttleDown')) control.throttle -= 1;
      if (mouse) {
        // Steer toward the pointer: right of centre banks right, low on the
        // screen pulls the nose up.
        control.bank = clamp(((mouse.x / width) - 0.5) * 2.4, -1, 1);
        control.pitch = clamp(((mouse.y / height) - 0.42) * 2.2, -1, 1);
      }
      return control;
    },
    /** Queued one-shot actions (confirm / pause), drained by the caller. */
    takeActions() {
      return actions.splice(0, actions.length);
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    },
  };
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
