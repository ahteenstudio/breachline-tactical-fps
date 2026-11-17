// BREACHLINE — hud.js
// Every DOM element the player reads: the crosshair, health and ammo,
// the round timer and score pips, the minimap, the kill feed, the buy
// shop and the menu / pause / end overlays. The simulation pushes numbers
// in; this module never decides game rules.

import { SHOP, WEAPONS } from './config.js';

export function createHud(callbacks) {
  const $ = (id) => document.getElementById(id);
  const els = {
    root: $('hud'),
    crosshair: $('crosshair'),
    hitmarker: $('hitmarker'),
    healthNum: $('health-num'),
    healthBar: $('health-bar'),
    armorNum: $('armor-num'),
    armorBar: $('armor-bar'),
    credits: $('credits'),
    ammoMag: $('ammo-mag'),
    ammoReserve: $('ammo-reserve'),
    weaponName: $('weapon-name'),
    roundTimer: $('round-timer'),
    roundLabel: $('round-label'),
    pipsYou: $('pips-you'),
    pipsFoe: $('pips-foe'),
    killfeed: $('killfeed'),
    banner: $('banner'),
    bannerTitle: $('banner-title'),
    bannerSub: $('banner-sub'),
    plantBar: $('plant-bar'),
    plantFill: $('plant-fill'),
    plantLabel: $('plant-label'),
    minimap: $('minimap'),
    overlay: $('overlay'),
    overlayTitle: $('overlay-title'),
    overlayCopy: $('overlay-copy'),
    overlayAction: $('overlay-action'),
    overlayStats: $('overlay-stats'),
    buyPanel: $('buy-panel'),
    buyTimer: $('buy-timer'),
    buyList: $('buy-list'),
    deployBtn: $('deploy-btn'),
    objective: $('objective'),
    damageFlash: $('damage-flash'),
    hint: $('hint'),
  };

  const mapCtx = els.minimap.getContext('2d');
  let bannerTimer = null;
  let hitTimer = null;

  function showBanner(title, sub, ms) {
    els.bannerTitle.textContent = title;
    els.bannerSub.textContent = sub || '';
    els.banner.classList.remove('hidden');
    els.banner.classList.add('pop');
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => els.banner.classList.add('hidden'), ms || 2400);
  }

  function showHitmarker(kill) {
    els.hitmarker.classList.add('on');
    els.hitmarker.classList.toggle('kill', !!kill);
    if (hitTimer) clearTimeout(hitTimer);
    hitTimer = setTimeout(() => els.hitmarker.classList.remove('on', 'kill'), 140);
  }

  function setCrosshairSpread(px) {
    els.crosshair.style.setProperty('--gap', `${4 + px * 14}px`);
  }

  function setHealth(hp, armor) {
    els.healthNum.textContent = Math.max(0, Math.ceil(hp));
    els.healthBar.style.width = `${Math.max(0, Math.min(100, hp))}%`;
    els.healthBar.classList.toggle('low', hp <= 30);
    els.armorNum.textContent = Math.ceil(armor);
    els.armorBar.style.width = `${Math.max(0, Math.min(100, armor))}%`;
    els.root.classList.toggle('critical', hp <= 30 && hp > 0);
  }

  function setAmmo(mag, reserve, name, reloading) {
    els.ammoMag.textContent = mag;
    els.ammoReserve.textContent = `/ ${reserve}`;
    els.weaponName.textContent = name + (reloading ? ' — RELOADING' : '');
    els.ammoMag.parentElement.classList.toggle('empty', mag === 0);
  }

  function setCredits(n) {
    els.credits.textContent = `₡ ${n}`;
  }

  function setTimer(sec, label) {
    const s = Math.max(0, Math.ceil(sec));
    els.roundTimer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    els.roundTimer.classList.toggle('urgent', s <= 10);
    if (label) els.roundLabel.textContent = label;
  }

  function setScore(you, foe, round) {
    els.pipsYou.innerHTML = '';
    els.pipsFoe.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const a = document.createElement('i');
      if (i < you) a.className = 'won';
      els.pipsYou.appendChild(a);
      const b = document.createElement('i');
      if (i < foe) b.className = 'won';
      els.pipsFoe.appendChild(b);
    }
    els.roundLabel.textContent = `ROUND ${Math.min(round, 5)} / 5`;
  }

  function feed(text, good) {
    const div = document.createElement('div');
    div.className = 'feed-line' + (good ? ' good' : '');
    div.textContent = text;
    els.killfeed.prepend(div);
    while (els.killfeed.children.length > 5) els.killfeed.lastChild.remove();
    setTimeout(() => div.classList.add('fade'), 4200);
  }

  function setObjective(text) {
    els.objective.textContent = text;
  }

  function setPlant(progress, label) {
    if (progress == null) {
      els.plantBar.classList.add('hidden');
      return;
    }
    els.plantBar.classList.remove('hidden');
    els.plantFill.style.width = `${Math.round(progress * 100)}%`;
    els.plantLabel.textContent = label || 'PLANTING';
  }

  function flashDamage() {
    els.damageFlash.classList.remove('go');
    void els.damageFlash.offsetWidth;
    els.damageFlash.classList.add('go');
  }

  function drawMinimap(world, player, bots, spike) {
    const c = mapCtx;
    const W = els.minimap.width;
    const H = els.minimap.height;
    const sx = W / 52;
    const sz = H / 40;
    const px = (x) => (x + 26) * sx;
    const pz = (z) => (z + 20) * sz;
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(7,6,15,0.85)';
    c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(34,211,238,0.14)';
    for (const s of world.solids) {
      if (s.kind === 'perimeter') continue;
      c.fillRect(px(s.x - s.w / 2), pz(s.z - s.d / 2), s.w * sx, s.d * sz);
    }
    c.strokeStyle = 'rgba(233,230,223,0.5)';
    c.strokeRect(1, 1, W - 2, H - 2);
    for (const key of ['A', 'B']) {
      const site = world.sites[key];
      c.fillStyle = key === 'A' ? '#22d3ee' : '#f472b6';
      c.beginPath();
      c.arc(px(site.x), pz(site.z), 5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#07060f';
      c.font = 'bold 8px system-ui';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(key, px(site.x), pz(site.z) + 0.5);
    }
    if (spike && spike.plantedAt) {
      c.fillStyle = '#ff2d55';
      c.beginPath();
      c.arc(px(spike.x), pz(spike.z), 4, 0, Math.PI * 2);
      c.fill();
    }
    for (const b of bots) {
      if (!b.alive) continue;
      c.fillStyle = '#ff2d55';
      c.beginPath();
      c.arc(px(b.x), pz(b.z), 3.5, 0, Math.PI * 2);
      c.fill();
    }
    // Player arrow, rotated by yaw.
    c.save();
    c.translate(px(player.x), pz(player.z));
    c.rotate(Math.atan2(Math.sin(player.yaw), Math.cos(player.yaw)) + Math.PI);
    c.fillStyle = '#e9e6df';
    c.beginPath();
    c.moveTo(0, -6);
    c.lineTo(4.5, 5);
    c.lineTo(-4.5, 5);
    c.closePath();
    c.fill();
    c.restore();
  }

  function showOverlay(kind, data) {
    const o = els.overlay;
    o.classList.remove('hidden');
    o.dataset.kind = kind;
    if (kind === 'menu') {
      els.overlayTitle.textContent = 'BREACHLINE';
      els.overlayCopy.innerHTML = 'Neon tactical FPS. Five rounds, first to three. Plant the spike at <b>A</b> or <b>B</b>, or drop all four rogue units — then hold the yard.';
      els.overlayAction.textContent = 'CLICK TO DEPLOY';
      els.overlayStats.innerHTML = 'WASD move &nbsp;·&nbsp; Mouse aim &nbsp;·&nbsp; Click fire &nbsp;·&nbsp; R reload &nbsp;·&nbsp; E plant &nbsp;·&nbsp; Shift sprint &nbsp;·&nbsp; RMB zoom';
    } else if (kind === 'paused') {
      els.overlayTitle.textContent = 'PAUSED';
      els.overlayCopy.textContent = 'Pointer released. Click to jump back in — the round is still live.';
      els.overlayAction.textContent = 'CLICK TO RESUME';
      els.overlayStats.textContent = '';
    } else if (kind === 'end') {
      els.overlayTitle.textContent = data.won ? 'YARD SECURED' : 'YARD LOST';
      els.overlayCopy.textContent = data.won
        ? 'Every rogue unit is down and the yard is yours. The crew is already talking about it.'
        : 'The rogue squad held the yard this time. Re-run the breach and take it back.';
      els.overlayAction.textContent = 'PLAY AGAIN';
      els.overlayStats.innerHTML = `Rounds <b>${data.you} — ${data.foe}</b> &nbsp;·&nbsp; Kills <b>${data.kills}</b> &nbsp;·&nbsp; Credits earned <b>₡${data.earned}</b>`;
    }
  }

  function hideOverlay() {
    els.overlay.classList.add('hidden');
  }

  function renderShop(credits, owned, current, onBuy) {
    els.buyList.innerHTML = '';
    for (const item of SHOP) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shop-item';
      const isWeapon = !!WEAPONS[item.id];
      const ownedAlready = isWeapon ? owned[item.id] : false;
      const afford = credits >= item.price;
      btn.disabled = ownedAlready || !afford;
      btn.innerHTML = `<span class="shop-key">${item.key}</span><span class="shop-label">${item.label}</span><span class="shop-price">₡${item.price}</span>`;
      if (ownedAlready) btn.innerHTML += '<span class="shop-owned">OWNED</span>';
      btn.addEventListener('click', () => onBuy(item.id));
      els.buyList.appendChild(btn);
    }
    const cur = document.createElement('div');
    cur.className = 'shop-current';
    cur.textContent = `Carrying: ${WEAPONS[current].name} · ₡${credits} credits`;
    els.buyList.appendChild(cur);
  }

  function showBuy(show, seconds) {
    els.buyPanel.classList.toggle('hidden', !show);
    if (show) els.buyTimer.textContent = `${Math.ceil(seconds)}s`;
  }

  function setBuyTimer(seconds) {
    els.buyTimer.textContent = `${Math.ceil(seconds)}s`;
  }

  function setHint(text) {
    els.hint.textContent = text || '';
  }

  els.overlayAction.addEventListener('click', () => callbacks.onOverlayAction());
  els.deployBtn.addEventListener('click', () => callbacks.onDeploy());

  return {
    els,
    showBanner,
    showHitmarker,
    setCrosshairSpread,
    setHealth,
    setAmmo,
    setCredits,
    setTimer,
    setScore,
    feed,
    setObjective,
    setPlant,
    flashDamage,
    drawMinimap,
    showOverlay,
    hideOverlay,
    renderShop,
    showBuy,
    setBuyTimer,
    setHint,
  };
}
