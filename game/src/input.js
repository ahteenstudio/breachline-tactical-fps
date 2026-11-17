// BREACHLINE — input.js
// Keyboard, mouse and pointer lock. The game reads movement from the key
// set and look deltas from the mouse while pointer lock holds; everything
// else (fire, reload, use, buy keys) is an edge-triggered event the main
// loop drains once per frame.

export function createInput(canvas, callbacks) {
  const keys = new Set();
  const state = {
    keys,
    locked: false,
    firing: false,
    aiming: false,
    lookX: 0,
    lookY: 0,
    // Edge events, drained by main.js each frame.
    pressed: [],
  };

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    state.pressed.push(event.code);
    if (event.code === 'Space') event.preventDefault();
    if (event.code === 'Tab') event.preventDefault();
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => {
    keys.clear();
    state.firing = false;
    state.aiming = false;
  });

  window.addEventListener('mousemove', (event) => {
    if (!state.locked) return;
    state.lookX += event.movementX || 0;
    state.lookY += event.movementY || 0;
  });
  window.addEventListener('mousedown', (event) => {
    if (!state.locked) return;
    if (event.button === 0) state.firing = true;
    if (event.button === 2) state.aiming = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) state.firing = false;
    if (event.button === 2) state.aiming = false;
  });
  window.addEventListener('contextmenu', (event) => event.preventDefault());

  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
    if (!state.locked) {
      state.firing = false;
      state.aiming = false;
    }
    if (callbacks.onLockChange) callbacks.onLockChange(state.locked);
  });
  document.addEventListener('pointerlockerror', () => {
    if (callbacks.onLockError) callbacks.onLockError();
  });

  return {
    state,
    requestLock() {
      try {
        canvas.requestPointerLock();
      } catch {
        // Pointer lock can throw if the browser refuses it; the game then
        // runs unlocked and the overlay explains the click-to-play flow.
      }
    },
    exitLock() {
      if (document.pointerLockElement) document.exitPointerLock();
    },
    drainLook() {
      const dx = state.lookX;
      const dy = state.lookY;
      state.lookX = 0;
      state.lookY = 0;
      return { dx, dy };
    },
    drainPressed() {
      const out = state.pressed;
      state.pressed = [];
      return out;
    },
    isDown(code) {
      return keys.has(code);
    },
    axis() {
      let x = 0;
      let z = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      const len = Math.hypot(x, z);
      if (len > 0) {
        x /= len;
        z /= len;
      }
      return { x, z };
    },
  };
}
