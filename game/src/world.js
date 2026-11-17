// BREACHLINE — world.js
// Kestrel Yard: the arena layout. A walled rectangle with two plant sites,
// a mid lane and two side lanes, crates and barricades that break sight
// lines, and a list of axis-aligned colliders the player and the bots both
// respect. The same collider list doubles as the minimap's drawing data.

import { ARENA, SITES } from './config.js';

export function buildWorld(rng) {
  // Every solid box: { x, z, w, d, h, kind } — kind drives its colour.
  const solids = [];

  function addBox(x, z, w, d, h, kind) {
    solids.push({ x, z, w, d, h, kind: kind || 'wall' });
    return solids[solids.length - 1];
  }

  // Perimeter walls.
  const hw = ARENA.width / 2;
  const hd = ARENA.depth / 2;
  addBox(0, -hd - 0.5, ARENA.width + 2, 1, ARENA.wallHeight, 'perimeter');
  addBox(0, hd + 0.5, ARENA.width + 2, 1, ARENA.wallHeight, 'perimeter');
  addBox(-hw - 0.5, 0, 1, ARENA.depth + 2, ARENA.wallHeight, 'perimeter');
  addBox(hw + 0.5, 0, 1, ARENA.depth + 2, ARENA.wallHeight, 'perimeter');

  // Mid wall with two gaps: it splits the yard into a south half (player
  // spawn) and a north half (the sites), and forces fights through lanes.
  addBox(-16, 2, 16, 1.2, 3.2, 'wall');
  addBox(16, 2, 16, 1.2, 3.2, 'wall');
  addBox(0, 2, 2.4, 1.2, 3.2, 'wall');

  // Site cover: low barricades the spike carrier can crouch behind.
  addBox(SITES.A.x - 2.4, SITES.A.z + 2.6, 4.4, 1, 1.5, 'barricade');
  addBox(SITES.A.x + 3.2, SITES.A.z - 1.4, 1, 4.2, 1.5, 'barricade');
  addBox(SITES.B.x + 2.4, SITES.B.z + 2.6, 4.4, 1, 1.5, 'barricade');
  addBox(SITES.B.x - 3.2, SITES.B.z - 1.4, 1, 4.2, 1.5, 'barricade');

  // Crates: seeded jitter so a ?seed= screenshot is reproducible, but
  // every match still feels slightly different.
  const crateSpots = [
    [-9, -5, 2.2], [9, -5, 2.2], [-9, 9, 2.6], [9, 9, 2.6],
    [-4, -8, 1.8], [5, -8, 1.8], [0, -12, 2.4], [-13, 6, 2.0], [13, 6, 2.0],
  ];
  const crates = [];
  for (const [cx, cz, size] of crateSpots) {
    const jx = rng.range(-0.7, 0.7);
    const jz = rng.range(-0.7, 0.7);
    const h = rng.pick([1.4, 1.4, 2.2]);
    const box = addBox(cx + jx, cz + jz, size, size, h, 'crate');
    crates.push(box);
  }

  // Tall pillars that frame the mid lane.
  addBox(-6, -3, 1.4, 1.4, 4.5, 'pillar');
  addBox(6, -3, 1.4, 1.4, 4.5, 'pillar');

  return {
    solids,
    crates,
    bounds: { minX: -hw, maxX: hw, minZ: -hd, maxZ: hd },
    sites: SITES,
  };
}

// Circle (player/bot) vs AABB collision: push the circle out of any solid
// it overlaps. Returns the corrected position.
export function resolveCircle(world, x, z, radius) {
  let px = x;
  let pz = z;
  for (const s of world.solids) {
    const minX = s.x - s.w / 2;
    const maxX = s.x + s.w / 2;
    const minZ = s.z - s.d / 2;
    const maxZ = s.z + s.d / 2;
    const cx = Math.max(minX, Math.min(px, maxX));
    const cz = Math.max(minZ, Math.min(pz, maxZ));
    const dx = px - cx;
    const dz = pz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      px = cx + (dx / d) * radius;
      pz = cz + (dz / d) * radius;
    } else {
      // Centre inside the box: push out along the smallest penetration.
      const pushL = px - minX + radius;
      const pushR = maxX - px + radius;
      const pushT = pz - minZ + radius;
      const pushB = maxZ - pz + radius;
      const m = Math.min(pushL, pushR, pushT, pushB);
      if (m === pushL) px = minX - radius;
      else if (m === pushR) px = maxX + radius;
      else if (m === pushT) pz = minZ - radius;
      else pz = maxZ + radius;
    }
  }
  const b = world.bounds;
  px = Math.max(b.minX + radius, Math.min(b.maxX - radius, px));
  pz = Math.max(b.minZ + radius, Math.min(b.maxZ - radius, pz));
  return { x: px, z: pz };
}

// 2D segment vs AABB test, for line of sight. Returns true when the
// segment from (x1,z1) to (x2,z2) is blocked by any solid taller than h.
export function segmentBlocked(world, x1, z1, x2, z2, h) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  for (const s of world.solids) {
    if (s.h < h) continue;
    const minX = s.x - s.w / 2;
    const maxX = s.x + s.w / 2;
    const minZ = s.z - s.d / 2;
    const maxZ = s.z + s.d / 2;
    let tmin = 0;
    let tmax = 1;
    if (Math.abs(dx) < 1e-9) {
      if (x1 < minX || x1 > maxX) continue;
    } else {
      let t1 = (minX - x1) / dx;
      let t2 = (maxX - x1) / dx;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }
    if (Math.abs(dz) < 1e-9) {
      if (z1 < minZ || z1 > maxZ) continue;
    } else {
      let t1 = (minZ - z1) / dz;
      let t2 = (maxZ - z1) / dz;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }
    return true;
  }
  return false;
}

export function insideSite(site, x, z) {
  const dx = x - site.x;
  const dz = z - site.z;
  return dx * dx + dz * dz <= site.radius * site.radius;
}
