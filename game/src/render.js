// Cumulus Courier — the renderer. A chase camera sits behind and above the
// courier plane; the sea, the island chain, the ring line and the runway
// are projected from the world's metre coordinates onto the canvas each
// frame, far to near. The bottom of the screen is the cockpit: three lit
// gauges (airspeed, artificial horizon, altimeter), a throttle bar and a
// compass tape, with the big HUD figures the bounty asks for across the top.

import { COURSE_LENGTH, RUNWAY_ALTITUDE } from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const FOCAL = 620; // projection focal length in pixels at 1280x720
const CAMERA_BACK = 13; // metres behind the plane
const CAMERA_UP = 4.2; // metres above it

// Decorative clouds live only in the renderer; a fixed seed keeps every
// frame of a flight consistent.
const clouds = (() => {
  const next = createRandom(20261126);
  const list = [];
  for (let i = 0; i < 46; i += 1) {
    list.push({
      x: (next() - 0.5) * 2600,
      y: 260 + next() * 420,
      z: next() * (COURSE_LENGTH + 1600) - 400,
      size: 60 + next() * 130,
    });
  }
  return list;
})();

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.floor(canvas.clientWidth * dpr);
    height = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }

  /** World point -> screen point, or null when behind the camera. */
  function project(plane, x, y, z, rollCos, rollSin) {
    const relX = x - plane.x;
    const relZ = z - plane.z;
    const sinH = Math.sin(plane.heading);
    const cosH = Math.cos(plane.heading);
    const camZ = relX * sinH + relZ * cosH + CAMERA_BACK;
    if (camZ < 2) return null;
    const camX = relX * cosH - relZ * sinH;
    const camY = y - (plane.y + CAMERA_UP);
    const scale = (FOCAL * (width / 1280)) / camZ;
    let sx = width / 2 + camX * scale;
    let sy = height * 0.46 - camY * scale;
    // Roll the whole view around the horizon centre with the bank.
    const dx = sx - width / 2;
    const dy = sy - height * 0.46;
    sx = width / 2 + dx * rollCos - dy * rollSin;
    sy = height * 0.46 + dx * rollSin + dy * rollCos;
    return { x: sx, y: sy, scale, z: camZ };
  }

  function draw(state, screen, best) {
    resize();
    const plane = state.plane;
    const roll = -plane.bank * 0.55;
    const rollCos = Math.cos(roll);
    const rollSin = Math.sin(roll);
    const horizonY = height * 0.46 + plane.pitch * height * 0.22;

    drawSky(horizonY, roll);
    drawSea(state, horizonY);
    drawClouds(state, rollCos, rollSin);
    drawIslands(state, rollCos, rollSin);
    drawRunway(state, rollCos, rollSin);
    drawRings(state, rollCos, rollSin);
    if (screen !== SCREEN_TITLE) drawPlane(plane);
    drawCockpit(state);
    drawHud(state, best);

    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_PAUSED) drawCentredPanel('PAUSED', 'Press P or Esc to keep flying');
    else if (screen === SCREEN_OVER) drawEnd(state, best);
    else if (state.messageTime > 0 && state.message) drawMessage(state.message);
  }

  function drawSky(horizonY, roll) {
    const sky = ctx.createLinearGradient(0, 0, 0, Math.max(horizonY, 1));
    sky.addColorStop(0, '#2f6fb4');
    sky.addColorStop(0.55, '#7db6e8');
    sky.addColorStop(1, '#dcefff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, Math.max(horizonY, 0));
    // Sun, high left, with a soft halo.
    const sunX = width * 0.2;
    const sunY = height * 0.13;
    const halo = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, height * 0.16);
    halo.addColorStop(0, 'rgba(255,244,200,0.95)');
    halo.addColorStop(0.25, 'rgba(255,240,190,0.55)');
    halo.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(sunX - height * 0.16, sunY - height * 0.16, height * 0.32, height * 0.32);
    void roll;
  }

  function drawSea(state, horizonY) {
    const sea = ctx.createLinearGradient(0, horizonY, 0, height);
    sea.addColorStop(0, '#3d8bc2');
    sea.addColorStop(0.4, '#1f6ea8');
    sea.addColorStop(1, '#0d4a78');
    ctx.fillStyle = sea;
    ctx.fillRect(0, Math.min(horizonY, height), width, height);
    // Whitecap streaks rushing past sell the speed; their spacing is tied to
    // distance flown so they stream correctly.
    ctx.strokeStyle = 'rgba(255,255,255,0.20)';
    ctx.lineWidth = Math.max(1, height / 360);
    const plane = state.plane;
    for (let i = 0; i < 9; i += 1) {
      const worldZ = Math.floor(plane.z / 90) * 90 + i * 90 + 45;
      const p = project(plane, plane.x, 0, worldZ, 1, 0);
      if (!p) continue;
      const y = p.y;
      if (y < horizonY || y > height) continue;
      const spread = (y - horizonY) * 1.9;
      ctx.beginPath();
      ctx.moveTo(width / 2 - spread, y);
      ctx.lineTo(width / 2 - spread * 0.35, y);
      ctx.moveTo(width / 2 + spread * 0.35, y);
      ctx.lineTo(width / 2 + spread, y);
      ctx.stroke();
    }
  }

  function drawClouds(state, rollCos, rollSin) {
    const plane = state.plane;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const cloud of clouds) {
      const p = project(plane, cloud.x, cloud.y, cloud.z, rollCos, rollSin);
      if (!p || p.z > 4200) continue;
      const r = cloud.size * p.scale * 0.5;
      if (r < 2) continue;
      ctx.globalAlpha = Math.max(0, 0.85 - p.z / 6000);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r * 1.7, r * 0.52, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x - r * 0.7, p.y + r * 0.1, r * 0.9, r * 0.4, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x + r * 0.75, p.y + r * 0.08, r * 1.0, r * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawIslands(state, rollCos, rollSin) {
    const plane = state.plane;
    const sorted = [...state.islands].sort((a, b) => (b.z - plane.z) - (a.z - plane.z));
    for (const island of sorted) {
      const base = project(plane, island.x, 0, island.z, rollCos, rollSin);
      if (!base || base.z > 5200) continue;
      const peak = project(plane, island.x, island.height, island.z, rollCos, rollSin);
      const left = project(plane, island.x - island.radius, 0, island.z, rollCos, rollSin);
      const right = project(plane, island.x + island.radius, 0, island.z, rollCos, rollSin);
      if (!peak || !left || !right) continue;
      const green = island.hueShift > 0.5 ? '#3f9e4d' : '#359552';
      const greenDark = island.hueShift > 0.5 ? '#2a7a38' : '#22703c';
      // Beach ring.
      ctx.fillStyle = '#e8d193';
      ctx.beginPath();
      ctx.ellipse(base.x, base.y, Math.abs(right.x - left.x) / 2 * 1.04, Math.min(Math.abs(right.x - left.x) / 9.5, height * 0.055), 0, 0, Math.PI * 2);
      ctx.fill();
      // Cone: lit left slope, shaded right slope, rocky cap on tall islands.
      ctx.fillStyle = green;
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(peak.x, peak.y);
      ctx.lineTo(right.x, right.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = greenDark;
      ctx.beginPath();
      ctx.moveTo(peak.x, peak.y);
      ctx.lineTo(right.x, right.y);
      ctx.lineTo(peak.x, right.y);
      ctx.closePath();
      ctx.fill();
      if (island.height > 78) {
        ctx.fillStyle = '#8d99a6';
        ctx.beginPath();
        ctx.moveTo(peak.x - (right.x - left.x) * 0.07, peak.y + (right.y - peak.y) * 0.3);
        ctx.lineTo(peak.x, peak.y);
        ctx.lineTo(peak.x + (right.x - left.x) * 0.07, peak.y + (right.y - peak.y) * 0.3);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawRunway(state, rollCos, rollSin) {
    const plane = state.plane;
    const zNear = COURSE_LENGTH - 60;
    const zFar = COURSE_LENGTH + 420;
    const corners = [
      project(plane, -30, RUNWAY_ALTITUDE, zNear, rollCos, rollSin),
      project(plane, 30, RUNWAY_ALTITUDE, zNear, rollCos, rollSin),
      project(plane, 30, RUNWAY_ALTITUDE, zFar, rollCos, rollSin),
      project(plane, -30, RUNWAY_ALTITUDE, zFar, rollCos, rollSin),
    ];
    if (corners.some((c) => c === null)) return;
    ctx.fillStyle = '#3c4147';
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 4; i += 1) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.fill();
    // Centreline dashes and threshold bars.
    ctx.strokeStyle = '#f5f7fa';
    ctx.lineWidth = Math.max(1, corners[0].scale * 1.6);
    ctx.setLineDash([corners[0].scale * 14, corners[0].scale * 12]);
    const midNear = project(plane, 0, RUNWAY_ALTITUDE, zNear, rollCos, rollSin);
    const midFar = project(plane, 0, RUNWAY_ALTITUDE, zFar, rollCos, rollSin);
    if (midNear && midFar) {
      ctx.beginPath();
      ctx.moveTo(midNear.x, midNear.y);
      ctx.lineTo(midFar.x, midFar.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Edge lights, warm and lit.
    ctx.fillStyle = '#ffd76a';
    for (let i = 0; i <= 6; i += 1) {
      const z = zNear + (i / 6) * (zFar - zNear);
      for (const side of [-33, 33]) {
        const p = project(plane, side, RUNWAY_ALTITUDE + 1, z, rollCos, rollSin);
        if (!p) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.4, p.scale * 1.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawRings(state, rollCos, rollSin) {
    const plane = state.plane;
    const sorted = [...state.rings].sort((a, b) => b.z - a.z);
    for (const ring of sorted) {
      const centre = project(plane, ring.x, ring.y, ring.z, rollCos, rollSin);
      if (!centre || centre.z > 3600) continue;
      const edge = project(plane, ring.x + ring.radius, ring.y, ring.z, rollCos, rollSin);
      if (!edge) continue;
      const rx = Math.abs(edge.x - centre.x);
      const ry = rx * 0.92;
      if (rx < 3) continue;
      const flown = ring.state === 'flown';
      const missed = ring.state === 'missed';
      ctx.lineWidth = Math.max(2, centre.scale * 2.6);
      ctx.strokeStyle = flown ? '#57e389' : missed ? 'rgba(150,160,170,0.5)' : '#ffb62e';
      ctx.shadowColor = flown ? '#57e389' : '#ff9d00';
      ctx.shadowBlur = missed ? 0 : 18;
      ctx.beginPath();
      ctx.ellipse(centre.x, centre.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineWidth = Math.max(1, centre.scale * 0.8);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.ellipse(centre.x, centre.y, rx * 0.86, ry * 0.86, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /** The courier plane from behind: high wing, twin tail booms, lit nav lights. */
  function drawPlane(plane) {
    const cx = width / 2;
    const cy = height * 0.66;
    const s = height / 720;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(plane.bank * 0.8);
    ctx.scale(s, s);
    // Shadow of the wing on the fuselage and the airframe.
    ctx.fillStyle = '#f2f5f7';
    ctx.strokeStyle = '#5a6a76';
    ctx.lineWidth = 2;
    // Main wing.
    ctx.beginPath();
    ctx.moveTo(-118, -16);
    ctx.lineTo(118, -16);
    ctx.lineTo(104, 2);
    ctx.lineTo(-104, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Orange wing tips.
    ctx.fillStyle = '#ff7a1a';
    ctx.fillRect(-118, -16, 20, 18);
    ctx.fillRect(98, -16, 20, 18);
    // Fuselage.
    ctx.fillStyle = '#fdfefe';
    ctx.beginPath();
    ctx.ellipse(0, 14, 27, 44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Cockpit glass.
    ctx.fillStyle = '#274b63';
    ctx.beginPath();
    ctx.ellipse(0, -8, 17, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tailplane and fin.
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.moveTo(-40, 48);
    ctx.lineTo(40, 48);
    ctx.lineTo(30, 60);
    ctx.lineTo(-30, 60);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-4, 30, 8, 26);
    // Propeller blur arc above the nose.
    ctx.strokeStyle = 'rgba(230,238,244,0.55)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(0, -34, 30, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Navigation lights: red left, green right, white tail — all lit.
    ctx.fillStyle = '#ff4040';
    ctx.beginPath(); ctx.arc(-118, -7, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3dff7a';
    ctx.beginPath(); ctx.arc(118, -7, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 60, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ----- cockpit & HUD -----

  function drawCockpit(state) {
    const plane = state.plane;
    const panelH = height * 0.17;
    const panelY = height - panelH;
    ctx.fillStyle = 'rgba(10,16,22,0.88)';
    ctx.fillRect(0, panelY, width, panelH);
    ctx.fillStyle = '#2b3a46';
    ctx.fillRect(0, panelY, width, 3);
    const cy = panelY + panelH * 0.54;
    const r = panelH * 0.4;
    drawSpeedGauge(width * 0.14, cy, r, plane.speed);
    drawHorizonGauge(width * 0.5, cy, r, plane);
    drawAltimeter(width * 0.86, cy, r, plane.y);
    // Throttle bar between the gauges.
    const barX = width * 0.3;
    const barW = width * 0.09;
    ctx.fillStyle = '#1c2833';
    ctx.fillRect(barX, cy - 5, barW, 10);
    ctx.fillStyle = '#ffb62e';
    ctx.fillRect(barX, cy - 5, barW * plane.throttle, 10);
    ctx.fillStyle = '#cfe3f2';
    ctx.font = `${Math.round(height * 0.02)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('THR', barX + barW / 2, cy + panelH * 0.32);
    const rpmX = width * 0.61;
    ctx.fillStyle = '#1c2833';
    ctx.fillRect(rpmX, cy - 5, barW, 10);
    ctx.fillStyle = '#57e389';
    ctx.fillRect(rpmX, cy - 5, barW * (0.25 + plane.throttle * 0.75), 10);
    ctx.fillStyle = '#cfe3f2';
    ctx.fillText('ENG', rpmX + barW / 2, cy + panelH * 0.32);
  }

  function gaugeShell(x, y, r, label) {
    ctx.fillStyle = '#101c26';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7fa6c4';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#9fc3e2';
    ctx.font = `${Math.round(r * 0.3)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + r * 0.72);
  }

  function drawSpeedGauge(x, y, r, speedMs) {
    gaugeShell(x, y, r, 'IAS kt');
    const knots = speedMs * 1.944;
    const angle = Math.PI * 0.75 + (knots / 180) * Math.PI * 1.5;
    ctx.strokeStyle = '#ffb62e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * r * 0.78, y + Math.sin(angle) * r * 0.78);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(r * 0.42)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(knots)), x, y - r * 0.18);
  }

  function drawHorizonGauge(x, y, r, plane) {
    gaugeShell(x, y, r, 'ATT');
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r * 0.86, 0, Math.PI * 2); ctx.clip();
    ctx.translate(x, y);
    ctx.rotate(-plane.bank);
    const lift = plane.pitch * r * 1.6;
    ctx.fillStyle = '#3d8bc2';
    ctx.fillRect(-r, -r + lift, r * 2, r * 2);
    ctx.fillStyle = '#8a6a42';
    ctx.fillRect(-r, lift, r * 2, r * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(-r, lift); ctx.lineTo(r, lift); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.4, y);
    ctx.lineTo(x - r * 0.12, y);
    ctx.moveTo(x + r * 0.12, y);
    ctx.lineTo(x + r * 0.4, y);
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + r * 0.1);
    ctx.stroke();
  }

  function drawAltimeter(x, y, r, altitude) {
    gaugeShell(x, y, r, 'ALT m');
    const angle = -Math.PI / 2 + (altitude / 1000) * Math.PI * 2;
    ctx.strokeStyle = '#57e389';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * r * 0.78, y + Math.sin(angle) * r * 0.78);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(r * 0.42)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(altitude)), x, y - r * 0.18);
  }

  function drawHud(state, best) {
    const plane = state.plane;
    const pad = width * 0.016;
    const boxH = height * 0.052;
    ctx.font = `bold ${Math.round(height * 0.026)}px system-ui, sans-serif`;
    const items = [
      `ALT ${Math.round(plane.y)} m`,
      `SPD ${Math.round(plane.speed * 1.944)} kt`,
      `HDG ${String(Math.round(((plane.heading * 180 / Math.PI) % 360 + 360) % 360)).padStart(3, '0')}°`,
      `VS ${plane.verticalSpeed >= 0 ? '+' : ''}${plane.verticalSpeed.toFixed(1)} m/s`,
    ];
    let x = pad;
    ctx.textAlign = 'left';
    for (const text of items) {
      const w = ctx.measureText(text).width + pad * 1.1;
      ctx.fillStyle = 'rgba(8,18,28,0.72)';
      ctx.fillRect(x, pad, w, boxH);
      ctx.strokeStyle = 'rgba(140,190,230,0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, pad, w, boxH);
      ctx.fillStyle = '#eaf6ff';
      ctx.fillText(text, x + pad * 0.55, pad + boxH * 0.68);
      x += w + pad * 0.6;
    }
    // Score block, top right.
    ctx.textAlign = 'right';
    const right = [
      `SCORE ${state.score}`,
      `RINGS ${state.ringsFlown}/${state.rings.length}`,
      `BEST ${Math.max(best, state.score)}`,
    ];
    let ry = pad;
    for (const text of right) {
      ctx.fillStyle = '#ffe9b0';
      ctx.fillText(text, width - pad, ry + boxH * 0.62);
      ry += boxH * 0.92;
    }
    // Next-ring guide arrow.
    const next = state.rings.find((ring) => ring.state === 'waiting');
    if (next && !state.over) {
      const p = project(state.plane, next.x, next.y, next.z, 1, 0);
      ctx.fillStyle = '#ffb62e';
      ctx.font = `bold ${Math.round(height * 0.03)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      if (p && p.x > 0 && p.x < width && p.y > 0 && p.y < height * 0.8) {
        ctx.fillText('◇', p.x, p.y - 14);
      } else {
        const dirX = next.x - state.plane.x;
        ctx.fillText(dirX < 0 ? '◀ NEXT RING' : 'NEXT RING ▶', width / 2, pad + boxH * 1.5);
      }
      const dist = Math.max(0, Math.round(next.z - state.plane.z));
      ctx.fillStyle = '#cfe3f2';
      ctx.font = `${Math.round(height * 0.02)}px system-ui, sans-serif`;
      ctx.fillText(`next ring ${dist} m`, width / 2, pad + boxH * (p ? 0.7 : 2.1));
    }
  }

  function drawMessage(text) {
    ctx.font = `bold ${Math.round(height * 0.032)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    const w = ctx.measureText(text).width + 36;
    ctx.fillStyle = 'rgba(8,18,28,0.7)';
    ctx.fillRect(width / 2 - w / 2, height * 0.16, w, height * 0.055);
    ctx.fillStyle = '#ffe9b0';
    ctx.fillText(text, width / 2, height * 0.16 + height * 0.038);
  }

  function drawCentredPanel(title, sub) {
    ctx.fillStyle = 'rgba(6,14,22,0.55)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(height * 0.06)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, height * 0.44);
    ctx.font = `${Math.round(height * 0.024)}px system-ui, sans-serif`;
    ctx.fillStyle = '#cfe3f2';
    ctx.fillText(sub, width / 2, height * 0.52);
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(6,14,22,0.38)';
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd76a';
    ctx.font = `bold ${Math.round(height * 0.085)}px system-ui, sans-serif`;
    ctx.fillText('CUMULUS COURIER', width / 2, height * 0.3);
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.round(height * 0.027)}px system-ui, sans-serif`;
    ctx.fillText('Fly the mail through every glowing ring, then land on the far island runway.', width / 2, height * 0.38);
    ctx.fillStyle = '#cfe3f2';
    ctx.font = `${Math.round(height * 0.023)}px system-ui, sans-serif`;
    ctx.fillText('Arrows steer · W/S throttle · drag the mouse to fly · P pauses', width / 2, height * 0.45);
    ctx.fillText('Enter or click to take off', width / 2, height * 0.5);
    if (best > 0) ctx.fillText(`Best score ${best}`, width / 2, height * 0.56);
    void state;
  }

  function drawEnd(state, best) {
    const title = state.landed ? 'DELIVERED!' : 'FLIGHT OVER';
    const lines = [
      state.message,
      `Score ${state.score} · rings ${state.ringsFlown}/${state.rings.length} · time ${state.time.toFixed(1)} s`,
      `Best ${Math.max(best, state.score)} — Enter or click to fly again`,
    ];
    ctx.fillStyle = 'rgba(6,14,22,0.5)';
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.fillStyle = state.landed ? '#57e389' : '#ff9d7a';
    ctx.font = `bold ${Math.round(height * 0.06)}px system-ui, sans-serif`;
    ctx.fillText(title, width / 2, height * 0.4);
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.round(height * 0.024)}px system-ui, sans-serif`;
    lines.forEach((line, i) => ctx.fillText(line, width / 2, height * (0.48 + i * 0.055)));
  }

  return { draw };
}
