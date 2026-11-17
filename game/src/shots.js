// BREACHLINE — shots.js
// Screenshot presets. ?shot=start|play|buy|end&seed=N renders the game in
// a fixed, readable state — the same code path the player plays, with the
// same scene, HUD and bots, just staged: a title screen, a mid-round
// firefight, the buy shop, and the victory screen. Real renders, never
// composited images.

export function parseShot() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return null;
  const seed = Number(params.get('seed') || 7);
  return { shot, seed: Number.isFinite(seed) ? seed : 7 };
}

// Stage one of the four presets. `game` is the object main.js returns:
// state, player, bots, hud, and the functions that move between states.
export function stageShot(game, preset) {
  const { shot } = preset;
  if (shot === 'start') {
    game.toMenu();
    game.orbitCamera(0.6);
    game.hud.setScore(0, 0, 1);
    game.hud.setHealth(100, 0);
    game.hud.setAmmo(12, 60, 'KESTREL P9', false);
    game.hud.setCredits(800);
    game.hud.setTimer(90, 'ROUND 1 / 5');
    game.hud.setObjective('Plant the spike at A or B — or eliminate the squad.');
  } else if (shot === 'play') {
    game.startMatch();
    game.setRound(3);
    game.startRound();
    game.setRoundTimeLeft(61);
    // Put two bots in view down the mid lane and one flanking, mid-fight.
    game.placeBot(0, -4, -6.5, 0.35);
    game.placeBot(1, 4, -9, -0.3);
    game.placeBot(2, 12, 2, -1.2);
    game.placeBot(3, -14, 6, 0.9);
    game.aimAt(-3.5, -6.5);
    game.hud.setScore(1, 1, 3);
    game.hud.setHealth(72, 25);
    game.hud.setAmmo(18, 90, 'VK-7 VANDAL', false);
    game.hud.setCredits(1400);
    game.hud.setTimer(61, 'ROUND 3 / 5');
    game.hud.setObjective('Spike carried — plant at A or B.');
    game.hud.feed('VEX ▸ dropped UNIT-02', true);
    game.hud.feed('UNIT-03 ▸ hit VEX', false);
    game.hud.showBanner('ROUND 3', 'First to 3 rounds takes the yard', 6000);
    game.fireTracerDemo();
  } else if (shot === 'buy') {
    game.startMatch();
    game.toBuy();
    game.hud.setScore(1, 0, 2);
    game.hud.setHealth(100, 50);
    game.hud.setAmmo(12, 60, 'KESTREL P9', false);
    game.hud.setCredits(2100);
    game.hud.setTimer(25, 'BUY PHASE');
    game.hud.setObjective('Buy up — the next round starts when you deploy.');
  } else if (shot === 'end') {
    game.startMatch();
    game.forceEnd(true, { kills: 9, earned: 2700 });
    game.hud.setScore(3, 1, 5);
    game.hud.setHealth(64, 0);
    game.hud.setAmmo(7, 30, 'VK-7 VANDAL', false);
    game.hud.setCredits(900);
    game.hud.setTimer(0, 'MATCH OVER');
    game.hud.setObjective('Yard secured. Play again?');
  }
}
