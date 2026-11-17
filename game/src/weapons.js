// BREACHLINE — weapons.js
// Firing, spread, recoil, reload and damage. A weapon is pure state plus
// a fire() that raycasts from the camera through the world: the first bot
// whose body the ray crosses takes the hit, otherwise the wall behind it
// eats the bullet and throws sparks.

import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { clamp } from './random.js';

const _ray = new THREE.Raycaster();
const _dir = new THREE.Vector3();

export function createLoadout() {
  return {
    owned: { p9: true },
    current: 'p9',
    mag: { p9: WEAPONS.p9.mag, vk7: 0, lance: 0 },
    reserve: { p9: WEAPONS.p9.reserve, vk7: 0, lance: 0 },
    armor: 0,
    reloading: false,
    reloadEnd: 0,
    lastShotAt: 0,
    spread: 0,
  };
}

export function weaponOf(loadout) {
  return WEAPONS[loadout.current];
}

export function buyWeapon(loadout, id, credits) {
  const w = WEAPONS[id];
  if (!w || loadout.owned[id]) return { ok: false, reason: 'owned' };
  if (credits < w.price) return { ok: false, reason: 'credits' };
  loadout.owned[id] = true;
  loadout.mag[id] = w.mag;
  loadout.reserve[id] = w.reserve;
  loadout.current = id;
  return { ok: true, cost: w.price };
}

export function switchWeapon(loadout, id) {
  if (!loadout.owned[id] || loadout.reloading) return false;
  loadout.current = id;
  return true;
}

export function startReload(loadout, now) {
  const w = weaponOf(loadout);
  if (loadout.reloading) return false;
  if (loadout.mag[loadout.current] >= w.mag) return false;
  if (loadout.reserve[loadout.current] <= 0) return false;
  loadout.reloading = true;
  loadout.reloadEnd = now + w.reloadMs;
  return true;
}

export function finishReload(loadout) {
  const w = weaponOf(loadout);
  const need = w.mag - loadout.mag[loadout.current];
  const take = Math.min(need, loadout.reserve[loadout.current]);
  loadout.mag[loadout.current] += take;
  loadout.reserve[loadout.current] -= take;
  loadout.reloading = false;
}

// Fire one shot. `targets` is the list of live bots with { mesh, hp }.
// Returns a report the main loop turns into HUD, sound and effects.
export function fireWeapon(loadout, camera, world, targets, now, rng, opts) {
  const w = weaponOf(loadout);
  const aiming = !!(opts && opts.aiming);
  if (loadout.reloading) return { fired: false, reason: 'reloading' };
  if (now - loadout.lastShotAt < w.fireIntervalMs) return { fired: false, reason: 'rate' };
  if (loadout.mag[loadout.current] <= 0) return { fired: false, reason: 'empty' };

  loadout.lastShotAt = now;
  loadout.mag[loadout.current] -= 1;

  // Spread grows while moving and firing, shrinks while still and aimed.
  const baseSpread = (w.spreadDeg * Math.PI) / 180;
  const moveSpread = opts && opts.moving ? 0.011 : 0;
  const aimSpread = aiming ? 0.35 : 1;
  const spread = (baseSpread + loadout.spread * 0.02 + moveSpread) * aimSpread;
  loadout.spread = clamp(loadout.spread + 0.35, 0, 1.6);

  camera.getWorldDirection(_dir);
  const yaw = Math.atan2(-_dir.x, -_dir.z);
  const pitch = Math.asin(clamp(_dir.y, -1, 1));
  const yawJ = yaw + (rng.next() - 0.5) * 2 * spread;
  const pitchJ = pitch + (rng.next() - 0.5) * 2 * spread;
  _dir.set(-Math.sin(yawJ) * Math.cos(pitchJ), Math.sin(pitchJ), -Math.cos(yawJ) * Math.cos(pitchJ));
  _ray.set(camera.getWorldPosition(new THREE.Vector3()), _dir);
  _ray.far = w.range;

  const origin = _ray.ray.origin;
  let best = null;
  let bestDist = Infinity;
  for (const t of targets) {
    if (!t.alive) continue;
    const hit = _ray.intersectObject(t.mesh, true)[0];
    if (hit && hit.distance < bestDist) {
      bestDist = hit.distance;
      best = { target: t, point: hit.point.clone(), distance: hit.distance, object: hit.object };
    }
  }

  // The wall behind the shot, for the tracer end and the spark.
  let endPoint = origin.clone().addScaledVector(_dir, w.range);
  let wallPoint = null;
  if (best) {
    endPoint = best.point;
  } else {
    // Cheap wall test: march the ray and stop at the first solid it enters.
    const step = 0.5;
    for (let d = step; d < w.range; d += step) {
      const px = origin.x + _dir.x * d;
      const py = origin.y + _dir.y * d;
      const pz = origin.z + _dir.z * d;
      if (py <= 0.05 || py >= 5) { wallPoint = new THREE.Vector3(px, Math.max(0.05, py), pz); break; }
      let inside = false;
      for (const s of world.solids) {
        if (px > s.x - s.w / 2 && px < s.x + s.w / 2 && pz > s.z - s.d / 2 && pz < s.z + s.d / 2 && py < s.h) {
          inside = true;
          break;
        }
      }
      if (inside) { wallPoint = new THREE.Vector3(px, py, pz); break; }
    }
    if (wallPoint) endPoint = wallPoint;
  }

  let damage = 0;
  let headshot = false;
  if (best) {
    // The visor/head box sits above y=1.7 in bot-local space; a hit on the
    // head mesh counts as a headshot.
    const localY = best.point.y - best.target.mesh.position.y;
    headshot = localY > 1.62 || best.object === best.target.mesh.userData.head;
    damage = w.damage * (headshot ? w.headshotMult : 1);
    best.target.hp -= damage;
  }

  return {
    fired: true,
    weapon: w,
    origin: origin.clone(),
    end: endPoint,
    wallPoint,
    hit: best ? { target: best.target, point: best.point, damage, headshot, killed: best.target.hp <= 0 } : null,
    spread,
  };
}
