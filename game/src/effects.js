// BREACHLINE — effects.js
// Short-lived visual feedback: tracers, impact sparks, muzzle flashes,
// explosions and the camera shake that sells them. Everything here is
// created, animated for a fraction of a second, and disposed.

import * as THREE from 'three';

export function createEffects(scene, camera) {
  const tracers = [];
  const bursts = [];
  const flashes = [];
  let shake = 0;
  let explosionMesh = null;
  let explosionLight = null;

  const muzzle = new THREE.PointLight(0xffc46b, 0, 9, 1.6);
  muzzle.position.set(0.26, -0.2, -1.1);
  camera.add(muzzle);

  function addTracer(from, to, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    tracers.push({ line, life: 0.09, max: 0.09 });
  }

  function addSparks(pos, color, count, speed) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI - Math.PI / 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      velocities.push(new THREE.Vector3(Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s + speed * 0.35, Math.sin(a) * Math.cos(b) * s));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.09, transparent: true, opacity: 1 });
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    bursts.push({ points, velocities, life: 0.5, max: 0.5 });
  }

  function flashMuzzle(intensity) {
    muzzle.intensity = intensity;
    flashes.push({ light: muzzle, life: 0.05, max: 0.05, peak: intensity });
  }

  function addShake(amount) {
    shake = Math.min(0.5, shake + amount);
  }

  function explode(pos) {
    if (!explosionMesh) {
      explosionMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1, 24, 18),
        new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.9 }),
      );
      explosionLight = new THREE.PointLight(0xff7a1a, 0, 30, 1.5);
      scene.add(explosionMesh);
      scene.add(explosionLight);
    }
    explosionMesh.position.set(pos.x, 1.2, pos.z);
    explosionMesh.scale.setScalar(0.2);
    explosionMesh.visible = true;
    explosionLight.position.set(pos.x, 2.5, pos.z);
    explosionLight.intensity = 300;
    addSparks({ x: pos.x, y: 1.2, z: pos.z }, 0xffb020, 90, 9);
    addSparks({ x: pos.x, y: 1.2, z: pos.z }, 0xff3d00, 60, 6);
    addShake(0.45);
  }

  function update(dt) {
    dt = Math.max(0, dt);
    for (let i = tracers.length - 1; i >= 0; i--) {
      const t = tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / t.max) * 0.95;
      if (t.life <= 0) {
        scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        tracers.splice(i, 1);
      }
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.life -= dt;
      const pos = b.points.geometry.attributes.position;
      for (let j = 0; j < b.velocities.length; j++) {
        pos.array[j * 3] += b.velocities[j].x * dt;
        pos.array[j * 3 + 1] += b.velocities[j].y * dt;
        pos.array[j * 3 + 2] += b.velocities[j].z * dt;
        b.velocities[j].y -= 12 * dt;
      }
      pos.needsUpdate = true;
      b.points.material.opacity = Math.max(0, b.life / b.max);
      if (b.life <= 0) {
        scene.remove(b.points);
        b.points.geometry.dispose();
        b.points.material.dispose();
        bursts.splice(i, 1);
      }
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.life -= dt;
      f.light.intensity = Math.max(0, (f.life / f.max)) * f.peak;
      if (f.life <= 0) {
        f.light.intensity = 0;
        flashes.splice(i, 1);
      }
    }
    if (explosionMesh && explosionMesh.visible) {
      const s = explosionMesh.scale.x + dt * 26;
      explosionMesh.scale.setScalar(s);
      explosionMesh.material.opacity = Math.max(0, 0.9 - s * 0.07);
      explosionLight.intensity = Math.max(0, explosionLight.intensity - dt * 900);
      if (s > 13) explosionMesh.visible = false;
    }
    if (shake > 0) {
      shake = Math.max(0, shake - dt * 1.4);
      const s = shake * shake * 0.5;
      camera.position.x += (Math.random() - 0.5) * s * 0.14;
      camera.position.y += (Math.random() - 0.5) * s * 0.14;
    }
  }

  return { addTracer, addSparks, flashMuzzle, addShake, explode, update };
}
