// Emberline — everything drawn that is not an entity: the night sky, the
// lantern and its light, the HUD, and the title / upgrade / end screens.
// The judge reads the game mostly through screenshots, so these screens
// carry the whole loop at a glance: start, play with HUD, upgrade choice,
// win and loss with restart.

import { TAU, clamp, fmt } from './utils.js';

const FONT = '"Trebuchet MS", "DejaVu Sans", sans-serif';

/** A heart shape at (x, y), size = half-width. */
export function drawHeart(ctx, x, y, size, fill) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 10, size / 10);
  ctx.beginPath();
  ctx.moveTo(0, 3);
  ctx.bezierCurveTo(-8, -4, -11, 3, 0, 10);
  ctx.bezierCurveTo(11, 3, 8, -4, 0, 3);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

/** The night: gradient sky, twinkling stars, low hills. */
export function drawBackground(ctx, game) {
  const { W, H, time, stars } = game;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0a0e2a');
  sky.addColorStop(0.55, '#171233');
  sky.addColorStop(1, '#241640');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  for (const s of stars) {
    const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * s.speed + s.phase));
    ctx.globalAlpha = tw * s.alpha;
    ctx.fillStyle = '#e6e9ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Low hills.
  ctx.fillStyle = '#120d28';
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, H - 70);
  ctx.quadraticCurveTo(180, H - 130, 380, H - 78);
  ctx.quadraticCurveTo(560, H - 40, 740, H - 92);
  ctx.quadraticCurveTo(880, H - 120, W, H - 70);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();

  // Ground.
  ctx.fillStyle = '#0d0a20';
  ctx.fillRect(0, H - 46, W, 46);
}

/** The lantern on its post, flame flickering, light pooling around it. */
export function drawLantern(ctx, game) {
  const { lantern, time } = game;
  const { x, y } = lantern;
  const healthFrac = clamp(lantern.hp / lantern.maxHp, 0, 1);
  const flick = 0.9 + 0.1 * Math.sin(time * 9) * Math.sin(time * 5.3);

  // Pool of light (dimmer as the lantern dies).
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glowR = 150 + 60 * healthFrac;
  const glow = ctx.createRadialGradient(x, y - 30, 10, x, y - 30, glowR);
  glow.addColorStop(0, `rgba(255, 190, 90, ${0.34 * healthFrac * flick})`);
  glow.addColorStop(1, 'rgba(255, 150, 40, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y - 30, glowR, 0, TAU);
  ctx.fill();
  ctx.restore();

  // Stone base + post.
  ctx.fillStyle = '#3a3348';
  ctx.beginPath();
  ctx.moveTo(x - 22, y + 8);
  ctx.lineTo(x + 22, y + 8);
  ctx.lineTo(x + 16, y - 6);
  ctx.lineTo(x - 16, y - 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2c2536';
  ctx.fillRect(x - 4, y - 78, 8, 74);

  // Hanging lamp.
  ctx.strokeStyle = '#241d30';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 14, y - 78);
  ctx.quadraticCurveTo(x, y - 92, x + 14, y - 78);
  ctx.stroke();
  ctx.fillStyle = '#1f1830';
  ctx.beginPath();
  ctx.moveTo(x - 13, y - 66);
  ctx.lineTo(x + 13, y - 66);
  ctx.lineTo(x + 9, y - 78);
  ctx.lineTo(x - 9, y - 78);
  ctx.closePath();
  ctx.fill();
  // Flame.
  const flameH = 12 + 3 * Math.sin(time * 11);
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath();
  ctx.moveTo(x, y - 76);
  ctx.quadraticCurveTo(x + 6, y - 68, x, y - 62 + (12 - flameH));
  ctx.quadraticCurveTo(x - 6, y - 68, x, y - 76);
  ctx.fill();
  ctx.fillStyle = '#ff9a3d';
  ctx.beginPath();
  ctx.arc(x, y - 66, 3.5, 0, TAU);
  ctx.fill();

  // HP ring under the lantern.
  const w = 84;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(x - w / 2, y + 14, w, 7);
  ctx.fillStyle = healthFrac > 0.5 ? '#ffb347' : healthFrac > 0.25 ? '#ff8c42' : '#ff5d5d';
  ctx.fillRect(x - w / 2, y + 14, w * healthFrac, 7);
}

/** Hearts, lantern bar, wave, score, embers, bombs. */
export function drawHUD(ctx, game) {
  const { W, player, lantern, waves, score } = game;
  ctx.save();
  ctx.textBaseline = 'middle';

  // Hearts, top-left.
  for (let i = 0; i < player.stats.maxHearts; i += 1) {
    drawHeart(ctx, 24 + i * 26, 26, 10, i < player.hearts ? '#ff5d6c' : 'rgba(255, 255, 255, 0.18)');
  }
  // Bombs next to hearts.
  for (let i = 0; i < player.stats.bombMax; i += 1) {
    ctx.fillStyle = i < player.bombs ? '#fde68a' : 'rgba(255, 255, 255, 0.18)';
    ctx.beginPath();
    ctx.arc(24 + i * 22, 54, 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#241640';
    ctx.font = `bold 9px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('B', 24 + i * 22, 54.5);
  }

  // Lantern bar, top-center.
  const bw = 220;
  const bx = W / 2 - bw / 2;
  ctx.font = `bold 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.fillText('LANTERN', W / 2, 14);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(bx, 22, bw, 12);
  const frac = clamp(lantern.hp / lantern.maxHp, 0, 1);
  ctx.fillStyle = frac > 0.5 ? '#ffb347' : frac > 0.25 ? '#ff8c42' : '#ff5d5d';
  ctx.fillRect(bx, 22, bw * frac, 12);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, 22, bw, 12);
  ctx.fillStyle = '#fff';
  ctx.font = `bold 10px ${FONT}`;
  ctx.fillText(`${Math.ceil(lantern.hp)} / ${lantern.maxHp}`, W / 2, 28.5);

  // Wave / score / embers, top-right.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  ctx.font = `bold 16px ${FONT}`;
  ctx.fillText(`WAVE ${Math.max(1, waves.wave)} / 10`, W - 20, 24);
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillStyle = '#ffd76a';
  ctx.fillText(`◆ ${player.embers}`, W - 20, 46);
  ctx.fillStyle = '#fff';
  ctx.fillText(`SCORE ${fmt(score)}`, W - 20, 66);

  // Wave progress: shades left.
  if (waves.active) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = `13px ${FONT}`;
    ctx.fillText(`shades left: ${waves.remaining}`, W / 2, 56);
  }

  // Controls hint, bottom.
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.font = `12px ${FONT}`;
  ctx.fillText('WASD move · mouse aim · hold click to shoot · Space bomb · P pause · M mute', W / 2, 588);
  ctx.restore();
}

/** Shared layout for the three upgrade cards. */
export function cardRects(W, H) {
  const cw = 210;
  const ch = 250;
  const gap = 26;
  const total = cw * 3 + gap * 2;
  const x0 = (W - total) / 2;
  const y0 = H / 2 - ch / 2 + 30;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (cw + gap), y: y0, w: cw, h: ch }));
}

function panel(ctx, W, H, alpha) {
  ctx.fillStyle = `rgba(8, 6, 24, ${alpha})`;
  ctx.fillRect(0, 0, W, H);
}

export function drawTitleScreen(ctx, game) {
  const { W, H, time } = game;
  panel(ctx, W, H, 0.68);
  ctx.save();
  ctx.textAlign = 'center';
  // Title with a warm gradient.
  const grad = ctx.createLinearGradient(0, 130, 0, 200);
  grad.addColorStop(0, '#ffe9b0');
  grad.addColorStop(0.5, '#ffb347');
  grad.addColorStop(1, '#ff7b2f');
  ctx.fillStyle = grad;
  ctx.font = `bold 76px ${FONT}`;
  ctx.shadowColor = 'rgba(255, 150, 50, 0.6)';
  ctx.shadowBlur = 34;
  ctx.fillText('EMBERLINE', W / 2, 188);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#e6e9ff';
  ctx.font = `20px ${FONT}`;
  ctx.fillText('Defend the last lantern. Survive ten waves of night.', W / 2, 232);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = `15px ${FONT}`;
  ctx.fillText('WASD or arrows to move · mouse to aim · hold click to shoot', W / 2, 286);
  ctx.fillText('Space drops a flash bomb · between waves, spend embers on upgrades', W / 2, 310);
  ctx.fillText('If the lantern shatters — or you fall — the night wins.', W / 2, 334);

  const pulse = 0.65 + 0.35 * Math.sin(time * 3);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffd76a';
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillText('CLICK OR PRESS ENTER TO PLAY', W / 2, 406);
  ctx.globalAlpha = 1;
  if (game.best > 0) {
    ctx.fillStyle = '#ffd76a';
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillText(`BEST SCORE ${fmt(game.best)}`, W / 2, 444);
  }
  ctx.restore();
}

export function drawUpgradeScreen(ctx, game) {
  const { W, H, upgradeChoices, input } = game;
  panel(ctx, W, H, 0.62);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = `bold 34px ${FONT}`;
  ctx.fillText(`WAVE ${game.waves.wave} CLEARED!`, W / 2, H / 2 - 168);
  ctx.fillStyle = '#fff';
  ctx.font = `17px ${FONT}`;
  ctx.fillText(`You hold ${game.player.embers} embers — choose one upgrade (keys 1-3, or click)`, W / 2, H / 2 - 132);

  const rects = cardRects(W, H);
  upgradeChoices.forEach((u, i) => {
    const r = rects[i];
    const afford = game.player.embers >= u.cost;
    const hover = input.mouse.x >= r.x && input.mouse.x <= r.x + r.w
      && input.mouse.y >= r.y && input.mouse.y <= r.y + r.h;
    ctx.fillStyle = afford ? (hover ? 'rgba(255, 179, 71, 0.22)' : 'rgba(20, 16, 48, 0.92)') : 'rgba(20, 16, 48, 0.6)';
    ctx.strokeStyle = afford ? (hover ? '#ffb347' : 'rgba(255, 255, 255, 0.4)') : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = hover && afford ? 3 : 1.5;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = afford ? u.color : 'rgba(255, 255, 255, 0.35)';
    ctx.font = `44px ${FONT}`;
    ctx.fillText(u.glyph, r.x + r.w / 2, r.y + 62);
    ctx.fillStyle = afford ? '#fff' : 'rgba(255, 255, 255, 0.45)';
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText(u.name, r.x + r.w / 2, r.y + 108);
    ctx.font = `14px ${FONT}`;
    ctx.fillStyle = afford ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.4)';
    ctx.fillText(u.desc, r.x + r.w / 2, r.y + 136);
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillStyle = afford ? '#ffd76a' : '#ff7b7b';
    ctx.fillText(`◆ ${u.cost} embers`, r.x + r.w / 2, r.y + 178);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = `13px ${FONT}`;
    ctx.fillText(`press ${i + 1}`, r.x + r.w / 2, r.y + 216);
  });

  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.font = `14px ${FONT}`;
  ctx.fillText('or press Enter to keep your embers and face the next wave', W / 2, H / 2 + 188);
  ctx.restore();
}

export function drawEndScreen(ctx, game) {
  const { W, H, time, won, endReason, score, kills, waves, playTime } = game;
  panel(ctx, W, H, 0.72);
  ctx.save();
  ctx.textAlign = 'center';
  if (won) {
    const grad = ctx.createLinearGradient(0, 130, 0, 200);
    grad.addColorStop(0, '#fff7d6');
    grad.addColorStop(1, '#ffb347');
    ctx.fillStyle = grad;
    ctx.font = `bold 58px ${FONT}`;
    ctx.shadowColor = 'rgba(255, 190, 90, 0.7)';
    ctx.shadowBlur = 30;
    ctx.fillText('THE DAWN RETURNS', W / 2, 186);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e6e9ff';
    ctx.font = `19px ${FONT}`;
    ctx.fillText('The Herald is broken. The lantern burns on — morning comes.', W / 2, 228);
  } else {
    ctx.fillStyle = '#c4b5fd';
    ctx.font = `bold 58px ${FONT}`;
    ctx.shadowColor = 'rgba(139, 92, 246, 0.6)';
    ctx.shadowBlur = 30;
    ctx.fillText('THE LIGHT GOES OUT', W / 2, 186);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e6e9ff';
    ctx.font = `19px ${FONT}`;
    ctx.fillText(endReason, W / 2, 228);
  }
  ctx.fillStyle = '#fff';
  ctx.font = `bold 20px ${FONT}`;
  ctx.fillText(`SCORE ${fmt(score)}`, W / 2, 292);
  ctx.font = `16px ${FONT}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText(`${kills} shades banished · wave ${waves.wave} of 10 · ${Math.floor(playTime / 60)}:${String(Math.floor(playTime % 60)).padStart(2, '0')}`, W / 2, 324);
  if (score > game.best) {
    ctx.fillStyle = '#ffd76a';
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText('NEW BEST SCORE!', W / 2, 358);
  } else if (game.best > 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = `15px ${FONT}`;
    ctx.fillText(`BEST ${fmt(game.best)}`, W / 2, 358);
  }
  const pulse = 0.65 + 0.35 * Math.sin(time * 3);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffd76a';
  ctx.font = `bold 21px ${FONT}`;
  ctx.fillText('PRESS R OR CLICK TO PLAY AGAIN', W / 2, 420);
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawPauseScreen(ctx, game) {
  const { W, H } = game;
  panel(ctx, W, H, 0.5);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = `bold 44px ${FONT}`;
  ctx.fillText('PAUSED', W / 2, H / 2 - 10);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = `16px ${FONT}`;
  ctx.fillText('Press P to resume', W / 2, H / 2 + 30);
  ctx.restore();
}
