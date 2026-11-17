// BREACHLINE — bots.js
// The rogue security squad. Each bot patrols waypoints until it hears a
// shot or sees the player, then hunts: it closes distance, strafes, and
// fires in bursts with line of sight. When the spike is planted, the
// nearest living bot pushes the site and channels a defuse instead.

import { botStatsForRound } from './config.js';
import { dist2d, angleDiff, clamp } from './random.js';
import { resolveCircle, segmentBlocked } from './world.js';
import { createBotMesh } from './render.js';

const PATROLS = [
  [[-16, -6], [-8, -12], [-16, -14], [-10, -4]],
  [[-4, -6], [2, -12], [-6, -14], [0, -4]],
  [[6, -6], [12, -12], [4, -14], [10, -4]],
  [[16, -6], [10, -12], [18, -14], [12, -4]],
];

export function createBots(scene, world, round, rng) {
  const stats = botStatsForRound(round);
  const bots = [];
  for (let i = 0; i < 4; i++) {
    const mesh = createBotMesh();
    const spawn = { x: -14 + i * 9.5, z: -14 };
    mesh.position.set(spawn.x, 0, spawn.z);
    scene.add(mesh);
    bots.push({
      id: i,
      mesh,
      hp: stats.hp,
      maxHp: stats.hp,
      alive: true,
      x: spawn.x,
      z: spawn.z,
      yaw: 0,
      state: 'patrol',
      waypoint: 0,
      patrol: PATROLS[i],
      alerted: false,
      lastShotAt: 0,
      burstLeft: 0,
      burstAt: 0,
      strafeDir: rng.chance(0.5) ? 1 : -1,
      strafeAt: 0,
      walkPhase: rng.range(0, 6),
      defusing: false,
      defuseProgress: 0,
      deathAt: 0,
      damage: stats.damage,
      fireIntervalMs: stats.fireIntervalMs,
      accuracyDeg: stats.accuracyDeg,
      speed: stats.speed,
      burst: stats.burst,
    });
  }
  return bots;
}

export function alertBots(bots, x, z, radius) {
  for (const b of bots) {
    if (!b.alive) continue;
    if (dist2d(b.x, b.z, x, z) <= radius) {
      b.alerted = true;
      if (b.state === 'patrol') b.state = 'hunt';
    }
  }
}

function hasLineOfSight(world, bx, bz, px, pz) {
  return !segmentBlocked(world, bx, bz, px, pz, 1.4);
}

export function updateBots(bots, world, player, dt, now, rng, events) {
  const px = player.x;
  const pz = player.z;
  for (const b of bots) {
    if (!b.alive) {
      // Fallen bots sink and fade out over two seconds.
      const t = (now - b.deathAt) / 2000;
      if (t < 1) {
        b.mesh.rotation.x = -Math.PI / 2 * Math.min(1, t * 1.4);
        b.mesh.position.y = -Math.min(0.5, t * 0.5);
      }
      continue;
    }

    const dist = dist2d(b.x, b.z, px, pz);
    const seen = dist < 34 && hasLineOfSight(world, b.x, b.z, px, pz);
    if (seen) {
      b.alerted = true;
      if (b.state === 'patrol') b.state = 'hunt';
    }

    let moveX = 0;
    let moveZ = 0;
    let targetYaw = b.yaw;

    if (events.spikePlanted && events.spikeSite) {
      // The spike is live: converge on its site, then defuse.
      const site = events.spikeSite;
      const dSite = dist2d(b.x, b.z, site.x, site.z);
      if (dSite > site.radius * 0.7) {
        const dx = (site.x - b.x) / dSite;
        const dz = (site.z - b.z) / dSite;
        moveX = dx;
        moveZ = dz;
        targetYaw = Math.atan2(dx, dz);
        b.state = 'defuse-run';
        b.defusing = false;
      } else {
        b.state = 'defusing';
        b.defusing = true;
        targetYaw = Math.atan2(px - b.x, pz - b.z);
        if (seen && dist < 20) {
          // A visible player interrupts the defuse: shoot instead.
          b.defusing = false;
        } else {
          b.defuseProgress += dt;
          if (b.defuseProgress >= 4) {
            events.onDefused(b);
            b.defuseProgress = 0;
          }
        }
      }
    } else if (b.state === 'patrol') {
      const wp = b.patrol[b.waypoint];
      const dx = wp[0] - b.x;
      const dz = wp[1] - b.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.6) {
        b.waypoint = (b.waypoint + 1) % b.patrol.length;
      } else {
        moveX = dx / d;
        moveZ = dz / d;
        targetYaw = Math.atan2(moveX, moveZ);
      }
    } else {
      // Hunt: close to firing range, then strafe while shooting.
      if (dist > 14) {
        const dx = (px - b.x) / dist;
        const dz = (pz - b.z) / dist;
        moveX = dx;
        moveZ = dz;
      } else if (dist < 6) {
        moveX = -(px - b.x) / dist;
        moveZ = -(pz - b.z) / dist;
      } else {
        if (now - b.strafeAt > 1400) {
          b.strafeDir *= -1;
          b.strafeAt = now;
        }
        const dx = (px - b.x) / dist;
        const dz = (pz - b.z) / dist;
        moveX = -dz * b.strafeDir * 0.7;
        moveZ = dx * b.strafeDir * 0.7;
      }
      targetYaw = Math.atan2(px - b.x, pz - b.z);
    }

    // Move with collision.
    const step = b.speed * dt * (b.defusing ? 0 : 1);
    const nx = b.x + moveX * step;
    const nz = b.z + moveZ * step;
    const fixed = resolveCircle(world, nx, nz, 0.45);
    const moved = Math.hypot(fixed.x - b.x, fixed.z - b.z);
    b.x = fixed.x;
    b.z = fixed.z;
    b.walkPhase += moved * 4.2;

    // Turn toward the target heading, smoothly.
    b.yaw += clamp(angleDiff(b.yaw, targetYaw), -3.2 * dt, 3.2 * dt);
    b.mesh.position.set(b.x, b.mesh.position.y, b.z);
    b.mesh.rotation.y = b.yaw;

    // Walk cycle: legs swing, arms steady the gun.
    const swing = Math.sin(b.walkPhase) * (moved > 0.001 ? 0.5 : 0);
    b.mesh.userData.legL.rotation.x = swing;
    b.mesh.userData.legR.rotation.x = -swing;
    b.mesh.userData.armL.rotation.x = -0.5 + swing * 0.2;

    // Shooting: bursts of three, only with line of sight.
    if (seen && !b.defusing && dist < 30) {
      if (b.burstLeft <= 0 && now - b.lastShotAt > b.fireIntervalMs) {
        b.burstLeft = b.burst;
        b.burstAt = now;
      }
      if (b.burstLeft > 0 && now - b.burstAt > 130) {
        b.burstAt = now;
        b.burstLeft -= 1;
        b.lastShotAt = now;
        const spreadRad = (b.accuracyDeg * Math.PI) / 180;
        const jitter = (rng.next() - 0.5) * 2 * spreadRad;
        const aimYaw = Math.atan2(px - b.x, pz - b.z) + jitter;
        const aimPitch = (1.45 - 1.5) / Math.max(1, dist) + (rng.next() - 0.5) * spreadRad;
        events.onBotShot(b, aimYaw, aimPitch, dist);
      }
    }
  }
}

// Roll a bot's shot against the player. Returns damage dealt (0 on miss).
export function resolveBotShot(bot, player, rng, dist) {
  const baseHit = 0.62 - dist * 0.012 - (player.crouching ? 0.08 : 0) - (player.moving ? 0.06 : 0);
  const hitChance = clamp(baseHit, 0.12, 0.7);
  if (rng.next() > hitChance) return 0;
  const crit = rng.chance(0.1);
  return Math.round(bot.damage * (crit ? 1.5 : 1));
}

export function killBot(bot, now) {
  bot.alive = false;
  bot.hp = 0;
  bot.deathAt = now;
  bot.defusing = false;
}
