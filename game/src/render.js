// BREACHLINE — render.js
// Everything the eye sees: the Three.js scene, the neon yard, the bot
// bodies, the player's viewmodel gun, tracers, sparks and the spike.
// Simulation never builds meshes directly; it asks this module for them.

import * as THREE from 'three';
import { ARENA, PALETTE, SITES } from './config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.bg);
  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.016);

  const camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.08, 220);
  camera.rotation.order = 'YXZ';

  // Cold moonlight from above, warm neon from the yard itself. Point
  // lights use physical falloff, so the intensities are large: a light
  // only reads a few metres out at these values.
  const hemi = new THREE.HemisphereLight(0x8b9dff, 0x1a0b2e, 1.35);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xbfd0ff, 1.7);
  moon.position.set(18, 30, 12);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -30;
  moon.shadow.camera.right = 30;
  moon.shadow.camera.top = 30;
  moon.shadow.camera.bottom = -30;
  moon.shadow.camera.far = 80;
  scene.add(moon);

  const neonA = new THREE.PointLight(SITES.A.color, 140, 30, 1.8);
  neonA.position.set(SITES.A.x, 3.2, SITES.A.z);
  scene.add(neonA);
  const neonB = new THREE.PointLight(SITES.B.color, 140, 30, 1.8);
  neonB.position.set(SITES.B.x, 3.2, SITES.B.z);
  scene.add(neonB);
  const midLight = new THREE.PointLight(0xf59e0b, 90, 24, 1.8);
  midLight.position.set(0, 4, 2);
  scene.add(midLight);

  return { scene, camera, moon };
}

function canvasTexture(draw, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildYard(scene, world) {
  const group = new THREE.Group();
  scene.add(group);

  // Floor: dark slabs with a glowing grid, drawn once on a canvas.
  const floorTex = canvasTexture((g, w, h) => {
    g.fillStyle = '#12101f';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(56,189,248,0.16)';
    g.lineWidth = 2;
    for (let x = 0; x <= w; x += 64) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
    }
    for (let y = 0; y <= h; y += 64) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    }
    g.strokeStyle = 'rgba(244,114,182,0.10)';
    for (let i = 0; i < 40; i++) {
      g.strokeRect(Math.random() * w, Math.random() * h, 46, 46);
    }
  }, 1024, 768);
  floorTex.wrapS = THREE.RepeatWrapping;
  floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(3, 2.2);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA.width + 2, ARENA.depth + 2),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85, metalness: 0.25 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: PALETTE.wall, roughness: 0.7, metalness: 0.4 });
  const wallTopMat = new THREE.MeshStandardMaterial({ color: PALETTE.wallTop, roughness: 0.5, metalness: 0.5 });
  const crateMat = new THREE.MeshStandardMaterial({ color: PALETTE.crate, roughness: 0.8, metalness: 0.3 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x0a0a12, emissive: PALETTE.crateTrim, emissiveIntensity: 1.6, roughness: 0.4 });

  for (const s of world.solids) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.d), s.kind === 'crate' ? crateMat : wallMat);
    mesh.position.set(s.x, s.h / 2, s.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    // A glowing cap on tall walls, a glowing edge on crates.
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(s.w + 0.04, 0.07, s.d + 0.04),
      s.kind === 'crate' ? trimMat : wallTopMat,
    );
    cap.position.set(s.x, s.h + 0.035, s.z);
    group.add(cap);
  }

  // Plant sites: glowing floor rings with a floating letter.
  const siteMeshes = {};
  for (const key of ['A', 'B']) {
    const site = SITES[key];
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(site.radius - 0.28, site.radius, 48),
      new THREE.MeshBasicMaterial({ color: site.color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(site.x, 0.03, site.z);
    group.add(ring);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(site.radius - 0.28, 48),
      new THREE.MeshBasicMaterial({ color: site.color, transparent: true, opacity: 0.1, side: THREE.DoubleSide }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(site.x, 0.02, site.z);
    group.add(disc);
    const letterTex = canvasTexture((g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.font = '900 180px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.shadowColor = '#ffffff';
      g.shadowBlur = 34;
      g.fillStyle = '#ffffff';
      g.fillText(site.label, w / 2, h / 2);
    }, 256, 256);
    const letter = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTex, color: site.color, transparent: true, opacity: 0.9, depthWrite: false }));
    letter.scale.set(2.6, 2.6, 1);
    letter.position.set(site.x, 3.4, site.z);
    group.add(letter);
    siteMeshes[key] = { ring, letter };
  }

  // Stars above the yard: the map is open-air, the sky is a dome of points.
  const starCount = 700;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.45;
    const r = 160;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi) + 6;
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xc7d2fe, size: 0.9, sizeAttenuation: false, fog: false }));
  group.add(stars);

  // Distant skyline silhouettes so the horizon is not empty fog.
  const skylineMat = new THREE.MeshBasicMaterial({ color: 0x0d0b1e, fog: true });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const r = 78 + (i % 5) * 6;
    const w = 6 + (i % 4) * 4;
    const h = 14 + ((i * 37) % 26);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), skylineMat);
    tower.position.set(Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r);
    group.add(tower);
  }

  return { group, siteMeshes };
}

// A bot is a boxy rogue security unit: dark plating, a red visor slit and
// a gun barrel. Built from boxes so it reads at a glance in the dark.
export function createBotMesh() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: PALETTE.botBody, roughness: 0.55, metalness: 0.6 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x120a14, roughness: 0.7, metalness: 0.4 });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x1a0505, emissive: PALETTE.botVisor, emissiveIntensity: 2.4 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x1a0505, emissive: PALETTE.botTrim, emissiveIntensity: 1.2 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.42), bodyMat);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.05), trimMat);
  chest.position.set(0, 1.35, 0.22);
  group.add(chest);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.4), darkMat);
  head.position.y = 1.82;
  head.castShadow = true;
  group.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.06), visorMat);
  visor.position.set(0, 1.84, 0.21);
  group.add(visor);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.7, 0.3), darkMat);
  legL.position.set(-0.2, 0.35, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.2;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.24), bodyMat);
  armL.position.set(-0.48, 1.2, 0.1);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.48;
  group.add(armR);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.85), darkMat);
  gun.position.set(0.48, 1.28, 0.45);
  group.add(gun);
  const barrelTip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.12), trimMat);
  barrelTip.position.set(0.48, 1.28, 0.9);
  group.add(barrelTip);

  group.userData = { legL, legR, armL, armR, torso, head, visor };
  return group;
}

// The player's gun, parented to the camera: a compact angular rifle with
// a cyan sight strip. It bobs with steps and kicks with every shot.
export function createViewmodel(camera) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x232338, roughness: 0.45, metalness: 0.7 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x0a0a12, emissive: 0x22d3ee, emissiveIntensity: 1.8 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x11111c, roughness: 0.8, metalness: 0.2 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.62), bodyMat);
  group.add(body);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.34), bodyMat);
  barrel.position.set(0, 0.02, -0.46);
  group.add(barrel);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.035, 0.16), accentMat);
  sight.position.set(0, 0.085, -0.12);
  group.add(sight);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.09), gripMat);
  grip.position.set(0, -0.13, 0.12);
  grip.rotation.x = 0.35;
  group.add(grip);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.1), gripMat);
  mag.position.set(0, -0.12, -0.05);
  mag.rotation.x = -0.15;
  group.add(mag);

  group.position.set(0.3, -0.3, -0.62);
  group.scale.setScalar(0.72);
  camera.add(group);
  return group;
}

// A spike device the carrier plants: a small dark case with a pulsing core.
export function createSpikeMesh() {
  const group = new THREE.Group();
  const caseMat = new THREE.MeshStandardMaterial({ color: 0x1c1c2c, roughness: 0.5, metalness: 0.7 });
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x220505, emissive: 0xff2d55, emissiveIntensity: 2.0 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.36), caseMat);
  box.position.y = 0.11;
  box.castShadow = true;
  group.add(box);
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.2), coreMat);
  core.position.y = 0.26;
  group.add(core);
  group.userData.core = core;
  return group;
}
