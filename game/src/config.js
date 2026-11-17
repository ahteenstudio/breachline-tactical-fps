// BREACHLINE — config.js
// Every tunable number of the game lives here: the arena, the rounds, the
// economy and the three weapons. Nothing in this file touches the DOM or
// Three.js, so the balance can be read and changed in one place.

export const GAME = {
  name: 'BREACHLINE',
  subtitle: 'Neon Tactical FPS',
  mapName: 'KESTREL YARD',
  roundsToWin: 3,
  maxRounds: 5,
  roundTimeSec: 90,
  buyTimeSec: 25,
  plantTimeSec: 3,
  detonateTimeSec: 12,
  defuseTimeSec: 4,
  startCredits: 800,
  killReward: 300,
  winReward: 600,
  lossReward: 300,
  plantReward: 300,
  botsPerRound: 4,
};

export const ARENA = {
  width: 48, // x: -24 .. 24
  depth: 36, // z: -18 .. 18
  wallHeight: 4.5,
  eyeHeight: 1.7,
  playerRadius: 0.45,
  gravity: 22,
  jumpSpeed: 7.5,
  walkSpeed: 6.2,
  sprintSpeed: 8.6,
  crouchSpeed: 3.4,
  crouchHeight: 1.15,
};

// Two plant sites: A on the west lane, B on the east lane. The spike carrier
// plants by standing inside a site's radius and holding the use key.
export const SITES = {
  A: { x: -17, z: -11, radius: 3.4, label: 'A', color: 0x22d3ee },
  B: { x: 17, z: -11, radius: 3.4, label: 'B', color: 0xf472b6 },
};

export const SPAWNS = {
  player: { x: 0, z: 14, yaw: Math.PI }, // faces north, toward the sites
  bots: [
    { x: -14, z: -14 },
    { x: -4, z: -15 },
    { x: 6, z: -15 },
    { x: 15, z: -14 },
  ],
};

export const WEAPONS = {
  p9: {
    id: 'p9',
    name: 'KESTREL P9',
    kind: 'sidearm',
    price: 0,
    damage: 24,
    headshotMult: 2.0,
    mag: 12,
    reserve: 60,
    fireIntervalMs: 240,
    auto: false,
    spreadDeg: 0.9,
    range: 60,
    reloadMs: 1100,
    zoom: 1,
    tracer: 0xffe08a,
  },
  vk7: {
    id: 'vk7',
    name: 'VK-7 VANDAL',
    kind: 'rifle',
    price: 900,
    damage: 30,
    headshotMult: 1.8,
    mag: 30,
    reserve: 120,
    fireIntervalMs: 115,
    auto: true,
    spreadDeg: 1.6,
    range: 70,
    reloadMs: 1700,
    zoom: 1,
    tracer: 0x67e8f9,
  },
  lance: {
    id: 'lance',
    name: 'LANCE LONGSHOT',
    kind: 'sniper',
    price: 1400,
    damage: 96,
    headshotMult: 2.2,
    mag: 5,
    reserve: 20,
    fireIntervalMs: 950,
    auto: false,
    spreadDeg: 0.15,
    range: 120,
    reloadMs: 2400,
    zoom: 2.6,
    tracer: 0xf0abfc,
  },
};

export const SHOP = [
  { id: 'vk7', label: 'VK-7 VANDAL — rifle', price: 900, key: '1' },
  { id: 'lance', label: 'LANCE LONGSHOT — sniper', price: 1400, key: '2' },
  { id: 'armor', label: 'PLATE VEST — 50 armor', price: 500, key: '3' },
  { id: 'medkit', label: 'MEDKIT — restore 50 HP', price: 300, key: '4' },
];

// Bots get a little sharper and tougher every round, so the same four bots
// feel like a harder squad as the match goes on.
export function botStatsForRound(round) {
  return {
    hp: 100 + (round - 1) * 15,
    damage: 9 + (round - 1) * 2,
    fireIntervalMs: Math.max(620, 950 - (round - 1) * 90),
    accuracyDeg: 3.4 - (round - 1) * 0.35,
    speed: 3.1 + (round - 1) * 0.25,
    burst: 3,
  };
}

export const PALETTE = {
  bg: 0x07060f,
  fog: 0x0b0a1a,
  floor: 0x12101f,
  wall: 0x1b1930,
  wallTop: 0x2a2650,
  crate: 0x232038,
  crateTrim: 0x22d3ee,
  siteA: 0x22d3ee,
  siteB: 0xf472b6,
  botBody: 0x3a1526,
  botVisor: 0xff2d55,
  botTrim: 0xff2d55,
  playerTracer: 0x67e8f9,
  accent: '#22d3ee',
  accent2: '#f472b6',
  gold: '#fbbf24',
};
