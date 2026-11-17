// BREACHLINE — main.js (part 1)
// The match itself: state machine, player movement, rounds, economy and
// the spike. Rendering lives in render.js, bots in bots.js, the HUD in
// hud.js; this file wires them together and owns the rules.

import * as THREE from 'three';
import { GAME, ARENA, SITES, SPAWNS, WEAPONS } from './config.js';
import { makeRng, clamp, lerp } from './random.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { buildWorld, resolveCircle, insideSite } from './world.js';
import { createRenderer, createScene, buildYard, createViewmodel, createSpikeMesh } from './render.js';
import { createEffects } from './effects.js';
import { createLoadout, weaponOf, buyWeapon, switchWeapon, startReload, finishReload, fireWeapon } from './weapons.js';
import { createBots, updateBots, alertBots, resolveBotShot, killBot } from './bots.js';
import { createHud } from './hud.js';
import { parseShot, stageShot } from './shots.js';

const canvas = document.getElementById('game-canvas');
const renderer = createRenderer(canvas);
const { scene, camera } = createScene();
scene.add(camera);
const audio = createAudio();
const effects = createEffects(scene, camera);
const viewmodel = createViewmodel(camera);

const shot = parseShot();
const seed = shot ? shot.seed : Math.floor(Date.now() % 2147483647);
const rng = makeRng(seed);
const world = buildWorld(rng);
const { siteMeshes } = buildYard(scene, world);

const spikeMesh = createSpikeMesh();
spikeMesh.visible = false;
scene.add(spikeMesh);

const input = createInput(canvas, {
  onLockChange(locked) {
    if (!locked && game.phase === 'play' && !game.shotMode) {
      game.phase = 'paused';
      hud.showOverlay('paused');
    }
  },
});

const hud = createHud({
  onOverlayAction() {
    audio.unlock();
    audio.click();
    if (game.phase === 'menu') {
      startMatch();
    } else if (game.phase === 'paused') {
      hud.hideOverlay();
      game.phase = 'play';
      input.requestLock();
    } else if (game.phase === 'matchEnd') {
      startMatch();
    }
  },
  onDeploy() {
    audio.unlock();
    if (game.phase === 'buy') startRound();
  },
});

// --- match state -----------------------------------------------------------
const game = {
  phase: 'menu', // menu | buy | play | roundEnd | matchEnd | paused
  shotMode: !!shot,
  shotType: shot ? shot.shot : null,
  round: 1,
  scoreYou: 0,
  scoreFoe: 0,
  credits: GAME.startCredits,
  kills: 0,
  earned: 0,
  roundTimeLeft: GAME.roundTimeSec,
  buyTimeLeft: GAME.buyTimeSec,
  roundEndAt: 0,
  spikePlanted: false,
  spikeSite: null,
  spikeTimer: 0,
  plantProgress: 0,
  plantBeepAt: 0,
  orbitT: 0,
};

const player = {
  x: SPAWNS.player.x,
  z: SPAWNS.player.z,
  y: ARENA.eyeHeight,
  vy: 0,
  yaw: SPAWNS.player.yaw,
  pitch: 0,
  hp: 100,
  crouching: false,
  moving: false,
  onGround: true,
  stepAt: 0,
};

const loadout = createLoadout();
let bots = [];
let prevFiring = false;
let recoil = 0;
let bobPhase = 0;
let lastMinimapAt = 0;

function resetPlayerForRound() {
  player.x = SPAWNS.player.x;
  player.z = SPAWNS.player.z;
  player.y = ARENA.eyeHeight;
  player.vy = 0;
  player.yaw = SPAWNS.player.yaw;
  player.pitch = 0;
  player.hp = 100;
  player.crouching = false;
  loadout.reloading = false;
  loadout.spread = 0;
}

function clearBots() {
  for (const b of bots) scene.remove(b.mesh);
  bots = [];
}

function spawnBots() {
  clearBots();
  bots = createBots(scene, world, game.round, rng);
}

function startMatch() {
  game.round = 1;
  game.scoreYou = 0;
  game.scoreFoe = 0;
  game.credits = GAME.startCredits;
  game.kills = 0;
  game.earned = 0;
  loadout.owned = { p9: true };
  loadout.current = 'p9';
  loadout.mag = { p9: WEAPONS.p9.mag, vk7: 0, lance: 0 };
  loadout.reserve = { p9: WEAPONS.p9.reserve, vk7: 0, lance: 0 };
  loadout.armor = 0;
  loadout.reloading = false;
  spikeMesh.visible = false;
  game.spikePlanted = false;
  game.spikeSite = null;
  toBuy();
}

function handleBuy(id) {
  if (id === 'armor') {
    if (game.credits < 500 || loadout.armor >= 50) { audio.denied(); return; }
    game.credits -= 500;
    loadout.armor = 50;
    audio.buy();
  } else if (id === 'medkit') {
    if (game.credits < 300 || player.hp >= 100) { audio.denied(); return; }
    game.credits -= 300;
    player.hp = Math.min(100, player.hp + 50);
    audio.buy();
  } else {
    const res = buyWeapon(loadout, id, game.credits);
    if (!res.ok) { audio.denied(); return; }
    game.credits -= res.cost;
    audio.buy();
  }
  hud.setCredits(game.credits);
  hud.setHealth(player.hp, loadout.armor);
  hud.renderShop(game.credits, loadout.owned, loadout.current, handleBuy);
  hud.setAmmo(loadout.mag[loadout.current], loadout.reserve[loadout.current], weaponOf(loadout).name, false);
}

function toBuy() {
  game.phase = 'buy';
  game.buyTimeLeft = GAME.buyTimeSec;
  game.plantProgress = 0;
  hud.hideOverlay();
  hud.showBuy(true, game.buyTimeLeft);
  hud.renderShop(game.credits, loadout.owned, loadout.current, handleBuy);
  hud.setScore(game.scoreYou, game.scoreFoe, game.round);
  hud.setObjective('Buy up — deploy when ready. Spike is yours to plant.');
  hud.setTimer(game.buyTimeLeft, 'BUY PHASE');
  input.exitLock();
}

function buyHandler(id) {
  // Kept for the shop's re-render path; handleBuy does the real work.
  handleBuy(id);
}

function startRound() {
  hud.showBuy(false);
  hud.hideOverlay();
  resetPlayerForRound();
  spawnBots();
  game.phase = 'play';
  game.roundTimeLeft = GAME.roundTimeSec;
  game.spikePlanted = false;
  game.spikeSite = null;
  game.plantProgress = 0;
  hud.setScore(game.scoreYou, game.scoreFoe, game.round);
  hud.setTimer(game.roundTimeLeft, `ROUND ${game.round} / 5`);
  hud.setObjective('Plant the spike at A or B — or eliminate the squad.');
  hud.setHealth(player.hp, loadout.armor);
  hud.setAmmo(loadout.mag[loadout.current], loadout.reserve[loadout.current], weaponOf(loadout).name, false);
  hud.setCredits(game.credits);
  hud.showBanner(`ROUND ${game.round}`, game.round === 1 ? 'Eliminate the squad or plant the spike' : 'First to 3 rounds takes the yard');
  if (!game.shotMode) input.requestLock();
}

function endRound(won, reason) {
  if (game.phase !== 'play') return;
  game.phase = 'roundEnd';
  game.roundEndAt = performance.now();
  spikeMesh.visible = false;
  game.spikePlanted = false;
  const reward = won ? GAME.winReward : GAME.lossReward;
  game.credits += reward;
  game.earned += reward;
  if (won) {
    game.scoreYou += 1;
    audio.roundWin();
    hud.showBanner('ROUND WON', `${reason} · +₡${reward}`, 2600);
  } else {
    game.scoreFoe += 1;
    audio.roundLose();
    hud.showBanner('ROUND LOST', `${reason} · +₡${reward}`, 2600);
  }
  hud.setScore(game.scoreYou, game.scoreFoe, game.round);
  hud.setCredits(game.credits);
  hud.setPlant(null);
  hud.setObjective(won ? 'Round secured. Next round coming up.' : 'Round lost. Buy up and go again.');
  input.exitLock();
}

function endMatch(won) {
  game.phase = 'matchEnd';
  hud.showBuy(false);
  hud.showOverlay('end', { won, you: game.scoreYou, foe: game.scoreFoe, kills: game.kills, earned: game.earned });
  input.exitLock();
}

function toMenu() {
  game.phase = 'menu';
  resetPlayerForRound();
  spawnBots();
  hud.showOverlay('menu');
  hud.showBuy(false);
  hud.setScore(0, 0, 1);
}

function damagePlayer(amount, fromBot) {
  if (game.phase !== 'play' || player.hp <= 0) return;
  let left = amount;
  if (loadout.armor > 0) {
    const absorbed = Math.min(loadout.armor, Math.round(left * 0.5));
    loadout.armor -= absorbed;
    left -= absorbed;
  }
  player.hp -= left;
  hud.setHealth(player.hp, loadout.armor);
  hud.flashDamage();
  audio.hurt();
  if (fromBot) hud.feed(`UNIT ▸ hit VEX for ${amount}`, false);
  if (player.hp <= 0) {
    player.hp = 0;
    hud.setHealth(0, loadout.armor);
    endRound(false, 'VEX is down');
  }
}

// --- player movement -------------------------------------------------------
function updatePlayer(dt, now) {
  const look = input.drainLook();
  const sens = 0.0021;
  player.yaw -= look.dx * sens;
  player.pitch = clamp(player.pitch - look.dy * sens, -1.45, 1.45);

  const axis = input.axis();
  player.crouching = input.isDown('ControlLeft') || input.isDown('KeyC');
  const sprinting = (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) && axis.z < 0 && !player.crouching;
  const speed = player.crouching ? ARENA.crouchSpeed : sprinting ? ARENA.sprintSpeed : ARENA.walkSpeed;
  player.moving = axis.x !== 0 || axis.z !== 0;

  const sin = Math.sin(player.yaw);
  const cos = Math.cos(player.yaw);
  const mx = axis.x * cos - axis.z * sin;
  const mz = axis.x * sin + axis.z * cos;
  const nx = player.x + mx * speed * dt;
  const nz = player.z + mz * speed * dt;
  const fixed = resolveCircle(world, nx, nz, ARENA.playerRadius);
  player.x = fixed.x;
  player.z = fixed.z;

  // Jump and gravity.
  if ((input.isDown('Space')) && player.onGround) {
    player.vy = ARENA.jumpSpeed;
    player.onGround = false;
  }
  player.vy -= ARENA.gravity * dt;
  player.y += player.vy * dt;
  const targetEye = player.crouching ? ARENA.crouchHeight : ARENA.eyeHeight;
  if (player.y <= targetEye) {
    player.y = targetEye;
    player.vy = 0;
    player.onGround = true;
  }

  if (player.moving && player.onGround && now - player.stepAt > (sprinting ? 280 : 380)) {
    player.stepAt = now;
    audio.step();
    bobPhase += Math.PI;
  }
  bobPhase += dt * (player.moving ? (sprinting ? 11 : 8) : 0);

  // Camera: position, look, zoom, bob, recoil.
  const bobY = player.moving && player.onGround ? Math.sin(bobPhase) * 0.035 : 0;
  const bobX = player.moving && player.onGround ? Math.cos(bobPhase * 0.5) * 0.02 : 0;
  camera.position.set(player.x + bobX * cos, player.y + bobY, player.z - bobX * sin);
  camera.rotation.set(player.pitch, player.yaw, 0);
  const w = weaponOf(loadout);
  const targetFov = input.state.aiming && w.zoom > 1 ? 78 / w.zoom : 78;
  if (Math.abs(camera.fov - targetFov) > 0.1) {
    camera.fov = lerp(camera.fov, targetFov, 1 - Math.pow(0.001, dt));
    camera.updateProjectionMatrix();
  }
  recoil = Math.max(0, recoil - dt * 6);
  viewmodel.position.z = -0.62 + recoil * 0.09;
  viewmodel.position.y = -0.3 + (player.moving && player.onGround ? Math.sin(bobPhase) * 0.008 : 0) + (loadout.reloading ? -0.12 : 0);
  viewmodel.rotation.x = recoil * 0.12;
}

// --- combat ----------------------------------------------------------------
function updateCombat(dt, now) {
  const w = weaponOf(loadout);
  if (loadout.reloading && now >= loadout.reloadEnd) {
    finishReload(loadout);
    hud.setAmmo(loadout.mag[loadout.current], loadout.reserve[loadout.current], w.name, false);
  }
  loadout.spread = Math.max(0, loadout.spread - dt * 1.8);

  const firing = input.state.firing;
  const wantFire = w.auto ? firing : firing && !prevFiring;
  prevFiring = firing;
  if (wantFire && !loadout.reloading) {
    if (loadout.mag[loadout.current] <= 0) {
      if (loadout.reserve[loadout.current] > 0) {
        if (startReload(loadout, now)) audio.reload();
      } else {
        audio.dryFire();
      }
    } else {
      const report = fireWeapon(loadout, camera, world, bots, now, rng, {
        aiming: input.state.aiming,
        moving: player.moving,
      });
      if (report.fired) {
        recoil = Math.min(1, recoil + (w.id === 'lance' ? 1 : 0.45));
        effects.flashMuzzle(w.id === 'lance' ? 90 : 55);
        effects.addTracer(report.origin, report.end, w.tracer);
        if (w.id === 'lance') effects.addShake(0.12);
        audio.shot(w.kind === 'sniper' ? 'lance' : w.kind === 'rifle' ? 'rifle' : 'p9');
        alertBots(bots, player.x, player.z, 26);
        if (report.wallPoint) effects.addSparks(report.wallPoint, 0xffc46b, 8, 3);
        if (report.hit) {
          const h = report.hit;
          hud.showHitmarker(h.killed);
          audio.hit();
          effects.addSparks(h.point, 0xff2d55, h.killed ? 26 : 12, 4);
          if (h.killed) {
            killBot(h.target, now);
            game.kills += 1;
            game.credits += GAME.killReward;
            game.earned += GAME.killReward;
            hud.setCredits(game.credits);
            hud.feed(`VEX ▸ dropped UNIT-0${h.target.id + 1}${h.headshot ? ' (headshot)' : ''}`, true);
            audio.kill();
            if (bots.every((b) => !b.alive)) endRound(true, 'Squad eliminated');
          }
        }
        hud.setAmmo(loadout.mag[loadout.current], loadout.reserve[loadout.current], w.name, false);
        hud.setCrosshairSpread(loadout.spread);
      }
    }
  }

  for (const code of input.drainPressed()) {
    if (code === 'KeyR') {
      if (startReload(loadout, now)) {
        audio.reload();
        hud.setAmmo(loadout.mag[loadout.current], loadout.reserve[loadout.current], w.name, true);
      }
    } else if (code === 'Digit1' && game.phase === 'play') {
      if (switchWeapon(loadout, 'p9')) hud.setAmmo(loadout.mag.p9, loadout.reserve.p9, WEAPONS.p9.name, false);
    } else if (code === 'Digit2' && game.phase === 'play') {
      if (switchWeapon(loadout, 'vk7')) hud.setAmmo(loadout.mag.vk7, loadout.reserve.vk7, WEAPONS.vk7.name, false);
    } else if (code === 'Digit3' && game.phase === 'play') {
      if (switchWeapon(loadout, 'lance')) hud.setAmmo(loadout.mag.lance, loadout.reserve.lance, WEAPONS.lance.name, false);
    } else if (code === 'KeyM') {
      audio.toggleMute();
    }
  }
}

// --- spike ------------------------------------------------------------------
function updateSpike(dt, now) {
  if (game.spikePlanted) {
    game.spikeTimer -= dt;
    hud.setTimer(game.spikeTimer, 'SPIKE LIVE');
    hud.setPlant(game.spikeTimer / GAME.detonateTimeSec, 'DETONATION');
    spikeMesh.userData.core.material.emissiveIntensity = 1.6 + Math.sin(now / 90) * 1.2;
    if (game.spikeTimer <= 0) {
      const site = game.spikeSite;
      effects.explode({ x: site.x, z: site.z });
      audio.explosion();
      endRound(true, 'Spike detonated');
    }
    return;
  }
  hud.setPlant(game.plantProgress > 0 ? game.plantProgress : null, 'PLANTING');
  const holdingE = input.isDown('KeyE');
  const site = insideSite(SITES.A, player.x, player.z) ? SITES.A : insideSite(SITES.B, player.x, player.z) ? SITES.B : null;
  if (game.phase === 'play' && holdingE && site) {
    game.plantProgress += dt / GAME.plantTimeSec;
    if (now - game.plantBeepAt > 500) {
      game.plantBeepAt = now;
      audio.plantTick();
    }
    hud.setHint(`Planting at site ${site.label} — hold E…`);
    if (game.plantProgress >= 1) {
      game.spikePlanted = true;
      game.spikeSite = site;
      game.spikeTimer = GAME.detonateTimeSec;
      game.credits += GAME.plantReward;
      game.earned += GAME.plantReward;
      hud.setCredits(game.credits);
      spikeMesh.position.set(site.x, 0, site.z);
      spikeMesh.visible = true;
      audio.planted();
      hud.showBanner('SPIKE PLANTED', `Defend site ${site.label} — detonation in ${GAME.detonateTimeSec}s`, 2600);
      hud.feed(`VEX ▸ planted the spike at ${site.label}`, true);
      hud.setObjective('Spike live — defend the site until detonation.');
      alertBots(bots, site.x, site.z, 60);
    }
  } else {
    game.plantProgress = Math.max(0, game.plantProgress - dt * 1.5);
    if (game.phase === 'play') {
      if (site) hud.setHint(`Hold E to plant the spike at site ${site.label}`);
      else hud.setHint('');
    }
  }
}

function onBotShot(bot, aimYaw, aimPitch, dist) {
  // Tracer from the bot's gun toward the player's chest.
  const from = { x: bot.x, y: 1.45, z: bot.z };
  const to = { x: player.x, y: 1.35, z: player.z };
  effects.addTracer(from, to, 0xff5a5a);
  audio.botShot();
  const dmg = resolveBotShot(bot, player, rng, dist);
  if (dmg > 0) damagePlayer(dmg, bot);
}

function onDefused(bot) {
  game.spikePlanted = false;
  game.spikeSite = null;
  spikeMesh.visible = false;
  hud.showBanner('SPIKE DEFUSED', 'The squad cut the charge — plant it again', 2600);
  hud.feed('UNIT ▸ defused the spike', false);
  hud.setObjective('Spike defused — plant again at A or B.');
  hud.setPlant(null);
  audio.denied();
}

// --- bot events --------------------------------------------------------------
const botEvents = {
  get spikePlanted() { return game.spikePlanted; },
  get spikeSite() { return game.spikeSite; },
  onBotShot,
  onDefused,
};

// --- main loop ---------------------------------------------------------------
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  // Clamp below at zero: the first rAF timestamp can predate module load
  // (the frame started before the scripts finished parsing), and a
  // negative dt would run every timer backwards and freeze muzzle flashes
  // on. Clamp above at 50 ms so a hitch never teleports the player.
  const dt = clamp((now - lastT) / 1000, 0, 0.05);
  lastT = now;

  if (game.phase === 'menu') {
    game.orbitT += dt * 0.06;
    const r = 20;
    camera.position.set(Math.cos(game.orbitT) * r, 11, Math.sin(game.orbitT) * r);
    camera.lookAt(0, 1, -4);
    for (const key of ['A', 'B']) {
      siteMeshes[key].letter.position.y = 3.4 + Math.sin(now / 700 + (key === 'A' ? 0 : 2)) * 0.15;
    }
  } else if (game.phase === 'play') {
    updatePlayer(dt, now);
    updateCombat(dt, now);
    updateSpike(dt, now);
    // In a screenshot preset the bots hold their staged positions so the
    // still shows the fight that was staged, instead of a patrol drift.
    if (!game.shotMode) updateBots(bots, world, player, dt, now, rng, botEvents);
    else if (game.shotType === 'play' && now - (game.demoAt || 0) > 1200) {
      game.demoAt = now;
      api.fireTracerDemo();
    }
    game.roundTimeLeft -= dt;
    if (!game.spikePlanted) hud.setTimer(game.roundTimeLeft, `ROUND ${game.round} / 5`);
    if (game.roundTimeLeft <= 0 && !game.spikePlanted) endRound(false, 'Time expired — spike never planted');
    if (now - lastMinimapAt > 120) {
      lastMinimapAt = now;
      hud.drawMinimap(world, player, bots, game.spikePlanted ? { plantedAt: true, x: game.spikeSite.x, z: game.spikeSite.z } : null);
    }
  } else if (game.phase === 'buy') {
    game.buyTimeLeft -= dt;
    hud.setBuyTimer(game.buyTimeLeft);
    for (const code of input.drainPressed()) {
      if (code === 'Enter') startRound();
      if (code === 'Digit1') hud.els.buyList.children[0]?.click();
      if (code === 'Digit2') hud.els.buyList.children[1]?.click();
      if (code === 'Digit3') hud.els.buyList.children[2]?.click();
      if (code === 'Digit4') hud.els.buyList.children[3]?.click();
    }
    if (game.buyTimeLeft <= 0) startRound();
  } else if (game.phase === 'roundEnd') {
    updateBots(bots, world, player, dt, now, rng, botEvents);
    if (now - game.roundEndAt > 2800) {
      if (game.scoreYou >= GAME.roundsToWin || game.scoreFoe >= GAME.roundsToWin || game.round >= GAME.maxRounds) {
        endMatch(game.scoreYou > game.scoreFoe);
      } else {
        game.round += 1;
        toBuy();
      }
    }
  }

  effects.update(dt);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- screenshot hooks (used by shots.js) --------------------------------------
const api = {
  phase: () => game.phase,
  toMenu,
  startMatch,
  startRound,
  toBuy,
  orbitCamera(t) { game.orbitT = t; },
  setRound(n) { game.round = n; },
  setRoundTimeLeft(s) { game.roundTimeLeft = s; },
  placeBot(i, x, z, yaw) {
    const b = bots[i];
    if (!b) return;
    b.alive = true;
    b.hp = b.maxHp;
    b.x = x;
    b.z = z;
    b.yaw = yaw;
    b.mesh.position.set(x, 0, z);
    b.mesh.rotation.set(0, yaw, 0);
    b.mesh.visible = true;
  },
  aimAt(x, z) {
    player.yaw = Math.atan2(-(x - player.x), -(z - player.z));
    player.pitch = 0.02;
  },
  fireTracerDemo() {
    const from = new THREE.Vector3(player.x, 1.5, player.z);
    effects.addTracer(
      { x: from.x, y: from.y, z: from.z },
      { x: -4, y: 1.4, z: -6.5 },
      0x67e8f9,
    );
    effects.addSparks({ x: -4, y: 1.4, z: -6.5 }, 0xff2d55, 14, 4);
    effects.flashMuzzle(60);
  },
  forceEnd(won, stats) {
    game.scoreYou = won ? 3 : 1;
    game.scoreFoe = won ? 1 : 3;
    game.kills = stats.kills;
    game.earned = stats.earned;
    endMatch(won);
  },
  hud,
};

toMenu();
if (shot) stageShot(api, shot);
requestAnimationFrame(frame);
