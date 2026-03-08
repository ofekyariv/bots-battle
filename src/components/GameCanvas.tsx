// ============================================================
// 🏴‍☠️ GameCanvas — HTML5 Canvas 2D renderer  v2-13
//
// Features:
//  • Dark ocean background with animated sine-wave lines
//  • Islands: circular land masses, owner-colored with smooth
//    color transitions, animated capture-progress arcs
//  • Island value indicators: floating "+N/tick" above islands
//  • Ships: triangular sprites, glow, capturing ring
//  • Ship trails: fading last-20-position path per team
//  • Dead ships: fading X marks
//  • Explosion particles: orange/red burst on ship death
//  • Combat radius: faint circles around ships when enemies nearby
//  • Safe zones: subtle gradient overlays on player sides
//  • Smooth camera: follows centroid of alive ships with lerp;
//    manual pan (drag) + zoom (scroll wheel)
//  • Minimap: 150×150 overlay in bottom-right corner
//  • Smooth 60fps interpolation between game ticks
//  • Responsive — fills its container via ResizeObserver
// ============================================================

'use client';

import { useEffect, useLayoutEffect, useRef, useCallback, memo } from 'react';
import type { FullGameState, Ship, Owner } from '@/engine/types';

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

export type CameraMode = 'dynamic' | 'static';

interface Props {
  gameState: FullGameState;
  mapWidth: number;
  mapHeight: number;
  showIslandIds?: boolean;
  cameraMode?: CameraMode;
  /**
   * When true, ship positions jump instantly to the current frame without
   * interpolating from the previous state. Use in replay scrubbing so the
   * canvas updates immediately instead of animating over tickRateMs ms.
   */
  disableInterpolation?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Color primitives
// ─────────────────────────────────────────────────────────────

interface RGB {
  r: number;
  g: number;
  b: number;
}

const P1_RGB: RGB = { r: 59, g: 130, b: 246 }; // blue-500
const P2_RGB: RGB = { r: 239, g: 68, b: 68 }; // red-500
const NEU_RGB: RGB = { r: 107, g: 114, b: 128 }; // gray-500

function ownerRGB(owner: Owner | 'none'): RGB {
  if (owner === 'player1') return P1_RGB;
  if (owner === 'player2') return P2_RGB;
  return NEU_RGB;
}

function rgba(c: RGB, a = 1): string {
  return `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${a})`;
}

function lighten(c: RGB, amt: number): RGB {
  return { r: Math.min(255, c.r + amt), g: Math.min(255, c.g + amt), b: Math.min(255, c.b + amt) };
}

function darken(c: RGB, amt: number): RGB {
  return { r: Math.max(0, c.r - amt), g: Math.max(0, c.g - amt), b: Math.max(0, c.b - amt) };
}

function lerpRGB(a: RGB, b: RGB, t: number): RGB {
  const s = Math.max(0, Math.min(1, t));
  return { r: a.r + (b.r - a.r) * s, g: a.g + (b.g - a.g) * s, b: a.b + (b.b - a.b) * s };
}

// ─────────────────────────────────────────────────────────────
// Math helpers
// ─────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  return (ax - bx) ** 2 + (ay - by) ** 2;
}

// ─────────────────────────────────────────────────────────────
// Explosion particle
// ─────────────────────────────────────────────────────────────

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 0..1, decreases over time
  size: number;
  color: RGB;
}

// ─────────────────────────────────────────────────────────────
// Camera
// ─────────────────────────────────────────────────────────────

interface Camera {
  x: number;
  y: number;
  zoom: number;
  targetX: number;
  targetY: number;
  targetZoom: number;
  isDragging: boolean;
  dragStartX: number;
  dragStartY: number;
  dragStartCamX: number;
  dragStartCamY: number;
  manualOverride: boolean;
  overrideUntil: number;
}

// ─────────────────────────────────────────────────────────────
// View params (updated each frame, used by mouse handlers)
// ─────────────────────────────────────────────────────────────

interface ViewParams {
  gx: number;
  gy: number;
  gameW: number;
  gameH: number;
  baseScale: number;
}

// ─────────────────────────────────────────────────────────────
// Ship rendering
// ─────────────────────────────────────────────────────────────

function drawShip(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  angle: number,
  color: RGB,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle + Math.PI / 2);

  ctx.beginPath();
  ctx.moveTo(0, -size * 1.6);
  ctx.lineTo(size * 0.65, size * 0.9);
  ctx.lineTo(0, size * 0.45);
  ctx.lineTo(-size * 0.65, size * 0.9);
  ctx.closePath();

  const hullGrad = ctx.createLinearGradient(0, -size * 1.6, 0, size * 0.9);
  hullGrad.addColorStop(0, rgba(lighten(color, 80)));
  hullGrad.addColorStop(0.55, rgba(color));
  hullGrad.addColorStop(1, rgba(darken(color, 30)));
  ctx.fillStyle = hullGrad;
  ctx.fill();

  ctx.strokeStyle = rgba({ r: 255, g: 255, b: 255 }, 0.55);
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, -size * 0.35, size * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = rgba({ r: 255, g: 255, b: 220 }, 0.9);
  ctx.fill();

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────
// Dead-ship rendering (fading X)
// ─────────────────────────────────────────────────────────────

function drawDeadShip(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  alpha: number,
  owner: Owner,
) {
  const c = ownerRGB(owner);
  ctx.save();
  ctx.globalAlpha = alpha * alpha;
  ctx.strokeStyle = rgba(c);
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - size, cy - size);
  ctx.lineTo(cx + size, cy + size);
  ctx.moveTo(cx + size, cy - size);
  ctx.lineTo(cx - size, cy + size);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = rgba(c, 0.6);
  ctx.fill();
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────
// Island color-transition state
// ─────────────────────────────────────────────────────────────

interface ColorTrans {
  from: RGB;
  to: RGB;
  startTime: number;
  duration: number;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Performance note
// ─────────────────────────────────────────────────────────────
// GameCanvas is wrapped in React.memo to prevent re-renders triggered
// by unrelated parent state changes (e.g. savedReplayId, isFinished).
// It still re-renders on every tick because `gameState` prop changes,
// which is necessary to keep the useEffect trail/explosion logic in sync.
//
// The actual drawing runs in a 60fps RAF loop (draw callback), fully
// decoupled from React renders. Hot paths identified via profiling:
//   • drawMinimap — called every frame; allocates gradient objects
//   • Ship trail rendering — O(ships × trail_length) per frame
//   • Sine wave animation — O(waveCount × steps) per frame (~840 ops)
//   • Particle system — grows up to 16*deaths particles, decays fast
// These are canvas-layer hot paths and cannot be further memoized.
// ─────────────────────────────────────────────────────────────

function GameCanvas({ gameState, mapWidth, mapHeight, showIslandIds = false, cameraMode = 'dynamic', disableInterpolation = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  // Whether the map is drawn rotated (portrait map on landscape viewport)
  const isRotatedRef = useRef(false);

  // Canvas physical / logical dimensions
  const dimsRef = useRef({ w: 800, h: 600, dpr: 1 });

  // Animation state
  const currStateRef = useRef<FullGameState>(gameState);
  const prevStateRef = useRef<FullGameState | null>(null);
  const lastTickRef = useRef<number>(Date.now());
  const lastDrawRef = useRef<number>(Date.now());

  // Ship angle tracking
  const shipAngleRef = useRef<Map<number, number>>(new Map());

  // Island color transitions
  const islandTransRef = useRef<Map<number, ColorTrans>>(new Map());
  const islandPrevOwner = useRef<Map<number, Owner>>(new Map());

  // ── NEW: particles, trails, camera ────────────────────────
  const particlesRef = useRef<Particle[]>([]);
  const trailsRef = useRef<Map<number, Array<{ x: number; y: number }>>>(new Map());
  const prevAliveRef = useRef<Map<number, boolean>>(new Map());

  const cameraRef = useRef<Camera>({
    x: mapWidth / 2,
    y: mapHeight / 2,
    zoom: 1,
    targetX: mapWidth / 2,
    targetY: mapHeight / 2,
    targetZoom: 1,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartCamX: 0,
    dragStartCamY: 0,
    manualOverride: false,
    overrideUntil: 0,
  });

  const viewRef = useRef<ViewParams>({
    gx: 0,
    gy: 0,
    gameW: 800,
    gameH: 600,
    baseScale: 0.8,
  });

  // ── Spawn explosion at world position ─────────────────────
  const spawnExplosion = useCallback((wx: number, wy: number) => {
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      const warm = Math.random() > 0.45;
      const c: RGB = warm
        ? { r: 255, g: 80 + Math.floor(Math.random() * 100), b: 10 }
        : { r: 255, g: 30, b: 30 };
      particlesRef.current.push({
        x: wx,
        y: wy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        size: 2.5 + Math.random() * 4,
        color: c,
      });
    }
  }, []);

  // Track disableInterpolation in a ref so the draw loop can read it without
  // being re-created on every prop change.
  const disableInterpolationRef = useRef(disableInterpolation);
  disableInterpolationRef.current = disableInterpolation;

  // ── Sync state on prop change (game tick) ─────────────────
  // useLayoutEffect (not useEffect) so currStateRef is updated *before* the
  // next RAF callback fires. With useEffect the RAF would read stale state for
  // one full paint cycle, making the canvas appear frozen during rapid slider
  // scrubbing even though the React UI (HUD, controls) updates correctly.
  useLayoutEffect(() => {
    prevStateRef.current = currStateRef.current;
    currStateRef.current = gameState;
    // When disableInterpolation is set (replay scrubbing), seed lastTickRef so
    // tInterp evaluates to 1 on the very next draw call — ships jump directly
    // to their recorded positions instead of animating from the previous frame.
    lastTickRef.current = disableInterpolationRef.current
      ? Date.now() - (gameState.config.tickRateMs ?? 100)
      : Date.now();

    const prev = prevStateRef.current;
    if (prev) {
      const prevMap = new Map<number, Ship>(prev.ships.map((s) => [s.id, s]));

      // Update ship angles
      for (const ship of gameState.ships) {
        const p = prevMap.get(ship.id);
        if (p && ship.alive && p.alive) {
          const dx = ship.x - p.x;
          const dy = ship.y - p.y;
          if (dx * dx + dy * dy > 0.001) {
            shipAngleRef.current.set(ship.id, Math.atan2(dy, dx));
          }
        }
        if (!shipAngleRef.current.has(ship.id)) {
          shipAngleRef.current.set(ship.id, ship.owner === 'player1' ? 0 : Math.PI);
        }
      }

      // Detect deaths → spawn explosions
      for (const ship of gameState.ships) {
        const wasAlive = prevAliveRef.current.get(ship.id);
        if (wasAlive === true && !ship.alive) {
          spawnExplosion(ship.x, ship.y);
        }
        prevAliveRef.current.set(ship.id, ship.alive);
      }
    }

    // Update ship trails (per tick)
    for (const ship of gameState.ships) {
      if (ship.alive) {
        const trail = trailsRef.current.get(ship.id) ?? [];
        trail.push({ x: ship.x, y: ship.y });
        if (trail.length > 20) trail.shift();
        trailsRef.current.set(ship.id, trail);
      }
    }

    // Island color transitions
    for (const island of gameState.islands) {
      const prevOwner = islandPrevOwner.current.get(island.id);
      if (prevOwner !== undefined && prevOwner !== island.owner) {
        islandTransRef.current.set(island.id, {
          from: ownerRGB(prevOwner),
          to: ownerRGB(island.owner),
          startTime: Date.now(),
          duration: 700,
        });
      }
      islandPrevOwner.current.set(island.id, island.owner);
    }
  }, [gameState, spawnExplosion]);

  // Camera mode ref for draw loop access
  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;

  // ── Minimap renderer ──────────────────────────────────────
  const drawMinimap = useCallback(
    (ctx: CanvasRenderingContext2D, curr: FullGameState, w: number, h: number, now: number) => {
      const MM = 150;
      const PAD = 10;
      const mx = w - MM - PAD;
      const my = h - MM - PAD;

      // Background
      ctx.fillStyle = 'rgba(1, 8, 16, 0.88)';
      ctx.beginPath();
      ctx.roundRect(mx - 2, my - 2, MM + 4, MM + 4, 4);
      ctx.fill();

      ctx.strokeStyle = 'rgba(80, 140, 210, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(mx - 2, my - 2, MM + 4, MM + 4, 4);
      ctx.stroke();

      // Scale factors — when rotated, world-Y → minimap-X, world-X → minimap-Y
      const rot = isRotatedRef.current;
      const mmW = rot ? mapHeight : mapWidth;
      const mmH = rot ? mapWidth : mapHeight;
      const sx = MM / mmW;
      const sy = MM / mmH;
      // Map world (wx,wy) → minimap pixel
      const mmx = (wx: number, wy: number) => mx + (rot ? wy : wx) * sx;
      const mmy = (wx: number, wy: number) => my + (rot ? (mapWidth - wx) : wy) * sy;

      // Safe zone shading
      const szWW = curr.config.safeZoneWidth;
      if (rot) {
        ctx.fillStyle = 'rgba(239,68,68,0.12)';
        ctx.fillRect(mx, my, MM, szWW * sy);
        ctx.fillStyle = 'rgba(59,130,246,0.12)';
        ctx.fillRect(mx, my + MM - szWW * sy, MM, szWW * sy);
      } else {
        // P2 safe zone at top
        ctx.fillStyle = 'rgba(239,68,68,0.12)';
        ctx.fillRect(mx, my, MM, szWW * sy);
        // P1 safe zone at bottom
        ctx.fillStyle = 'rgba(59,130,246,0.12)';
        ctx.fillRect(mx, my + MM - szWW * sy, MM, szWW * sy);
      }

      // Islands
      for (const island of curr.islands) {
        const c = ownerRGB(island.owner);
        const ix = mmx(island.x, island.y);
        const iy = mmy(island.x, island.y);
        const ir = Math.max(3, island.radius * sx * 0.55);

        ctx.beginPath();
        ctx.arc(ix, iy, ir, 0, Math.PI * 2);
        ctx.fillStyle = rgba(c, 0.75);
        ctx.fill();
        ctx.strokeStyle = rgba(lighten(c, 40), 0.9);
        ctx.lineWidth = 1;
        ctx.stroke();

        // Capture arc on minimap
        if (island.teamCapturing !== 'none' && island.captureProgress > 0) {
          const tc = island.teamCapturing as Owner;
          const total =
            island.owner !== 'neutral' && island.owner !== tc
              ? island.captureTurns * 2
              : island.captureTurns;
          const prog = Math.min(island.captureProgress / total, 1);
          const cc = ownerRGB(tc);
          ctx.beginPath();
          ctx.arc(ix, iy, ir + 2, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
          ctx.strokeStyle = rgba(cc, 0.9);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Ship dots
      for (const ship of curr.ships) {
        if (!ship.alive) continue;
        const c = ownerRGB(ship.owner);
        const bx = mmx(ship.x, ship.y);
        const by = mmy(ship.x, ship.y);
        ctx.beginPath();
        ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = rgba(c, 1);
        ctx.fill();
      }

      // Camera viewport rectangle
      const cam = cameraRef.current;
      const { gx, gy, gameW, gameH, baseScale } = viewRef.current;
      void gx;
      void gy; // suppress unused warnings
      const effectiveScale = baseScale * cam.zoom;
      if (effectiveScale > 0) {
        // Camera viewport in minimap coords
        // When rotated: screen-X covers world-Y axis, screen-Y covers world-X axis
        const camScreenX = rot ? cam.y : cam.x;
        const camScreenY = rot ? (mapWidth - cam.x) : cam.y;
        const vpW = (gameW / effectiveScale) * sx;
        const vpH = (gameH / effectiveScale) * sy;
        const vpX = mx + (camScreenX - gameW / effectiveScale / 2) * sx;
        const vpY = my + (camScreenY - gameH / effectiveScale / 2) * sy;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(vpX, vpY, vpW, vpH);
        ctx.setLineDash([]);
      }

      // Label
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('MAP', mx + MM - 3, my + MM - 3);

      // Double-click hint (only while zoomed)
      if (cam.zoom > 1.15 || cam.manualOverride) {
        const pulse = 0.35 + 0.25 * Math.sin(now / 600);
        ctx.font = '8px monospace';
        ctx.fillStyle = `rgba(255,255,255,${pulse.toFixed(2)})`;
        ctx.textAlign = 'center';
        ctx.fillText('dbl-click to reset', mx + MM / 2, my - 4);
      }
    },
    [mapWidth, mapHeight],
  );

  // ── Main draw loop ─────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const curr = currStateRef.current;
    const prev = prevStateRef.current;
    const { w, h, dpr } = dimsRef.current;
    const now = Date.now();

    // Per-frame delta time (seconds) for physics update
    const dt = Math.min((now - lastDrawRef.current) / 1000, 0.1);
    lastDrawRef.current = now;

    // Tick interpolation factor [0,1]
    const elapsed = now - lastTickRef.current;
    const tickMs = curr.config.tickRateMs || 100;
    const tInterp = Math.min(elapsed / tickMs, 1);

    // ── Update camera ────────────────────────────────────────
    const cam = cameraRef.current;

    // Camera behavior based on mode
    if (cameraModeRef.current === 'static') {
      // Static: always center on map, fit entire map
      cam.targetX = mapWidth / 2;
      cam.targetY = mapHeight / 2;
      cam.targetZoom = 1;
      cam.manualOverride = false;
    } else {
      // Dynamic: follow centroid of alive ships
      const alive = curr.ships.filter((s) => s.alive);
      if (alive.length > 0) {
        const cx = alive.reduce((s, sh) => s + sh.x, 0) / alive.length;
        const cy = alive.reduce((s, sh) => s + sh.y, 0) / alive.length;
        cam.targetX = cx;
        cam.targetY = cy;
      } else {
        cam.targetX = mapWidth / 2;
        cam.targetY = mapHeight / 2;
      }
      cam.targetZoom = 1;
    }

    const camLerp = Math.min(1, 3.5 * dt);
    cam.x = lerp(cam.x, cam.targetX, camLerp);
    cam.y = lerp(cam.y, cam.targetY, camLerp);
    cam.zoom = lerp(cam.zoom, cam.targetZoom, camLerp);

    // Clamp camera to map bounds (with small margin)
    const margin = 50;
    cam.x = Math.max(-margin, Math.min(mapWidth + margin, cam.x));
    cam.y = Math.max(-margin, Math.min(mapHeight + margin, cam.y));
    cam.targetX = Math.max(-margin, Math.min(mapWidth + margin, cam.targetX));
    cam.targetY = Math.max(-margin, Math.min(mapHeight + margin, cam.targetY));

    // ── Update particles ─────────────────────────────────────
    for (const p of particlesRef.current) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.max(0, 1 - dt * 4);
      p.vy *= Math.max(0, 1 - dt * 4);
      p.life -= dt * 2; // lifetime ~0.5s
    }
    particlesRef.current = particlesRef.current.filter((p) => p.life > 0);

    // ── Letterboxed viewport (with orientation-aware rotation) ─
    // When rotated, we draw the map with swapped axes: game-X maps to
    // screen-Y and game-Y maps to screen-X. This lets a portrait map
    // fill a landscape viewport without CSS rotation, keeping text upright.
    const rotated = isRotatedRef.current;
    // Effective map dimensions as seen on screen
    const effMapW = rotated ? mapHeight : mapWidth;
    const effMapH = rotated ? mapWidth : mapHeight;
    const gameAspect = effMapW / effMapH;
    const scrAspect = w / h;
    let gameW: number, gameH: number, gx: number, gy: number;
    if (scrAspect > gameAspect) {
      gameH = h;
      gameW = gameH * gameAspect;
      gx = (w - gameW) / 2;
      gy = 0;
    } else {
      gameW = w;
      gameH = gameW / gameAspect;
      gx = 0;
      gy = (h - gameH) / 2;
    }
    const baseScale = gameW / effMapW;
    const effectiveScale = baseScale * cam.zoom;

    // Store for mouse handlers
    viewRef.current = { gx, gy, gameW, gameH, baseScale };

    // Coordinate transforms (world → canvas logical px)
    // When rotated (portrait map on landscape screen):
    //   world-Y → screen-X, world-X → screen-Y
    //   Camera x/y still track world coords; we swap in the transform.
    const camSX = rotated ? cam.y : cam.x; // camera in screen-X world axis
    const camSY = rotated ? (mapWidth - cam.x) : cam.y; // camera in screen-Y world axis (flipped so P1/blue at bottom)
    // toScreen: takes world (x,y), returns screen (sx, sy)
    const toSX = (wx: number, wy: number) => gx + gameW / 2 + ((rotated ? wy : wx) - camSX) * effectiveScale;
    const toSY = (wx: number, wy: number) => gy + gameH / 2 + ((rotated ? (mapWidth - wx) : wy) - camSY) * effectiveScale;
    const tr = (r: number) => r * effectiveScale;

    // ── Begin frame ──────────────────────────────────────────
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Gutters
    ctx.fillStyle = '#010810';
    ctx.fillRect(0, 0, w, h);

    // ── Ocean background ─────────────────────────────────────
    const oceanGrad = ctx.createLinearGradient(gx, gy, gx + gameW, gy + gameH);
    oceanGrad.addColorStop(0, '#020d1e');
    oceanGrad.addColorStop(0.35, '#031627');
    oceanGrad.addColorStop(0.65, '#031627');
    oceanGrad.addColorStop(1, '#020d1e');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(gx, gy, gameW, gameH);

    // ── Animated waves (sine-displaced horizontal lines) ─────
    ctx.save();
    ctx.beginPath();
    ctx.rect(gx, gy, gameW, gameH);
    ctx.clip();

    const wt = now / 3500;
    const waveSpacing = Math.max(14, gameH / 28);
    const waveCount = Math.ceil(gameH / waveSpacing) + 1;

    for (let i = 0; i < waveCount; i++) {
      const baseY = gy + i * waveSpacing;
      const phaseShift = i * 0.18;
      const amp = 2.5 + 1.5 * Math.sin(wt * 0.7 + phaseShift);
      const alpha = 0.04 + 0.035 * Math.abs(Math.sin(wt * 0.5 + phaseShift));

      ctx.beginPath();
      // Build sine-displaced horizontal path
      const steps = Math.ceil(gameW / 12);
      ctx.moveTo(gx, baseY + amp * Math.sin(wt + phaseShift));
      for (let j = 1; j <= steps; j++) {
        const px = gx + (j / steps) * gameW;
        const py = baseY + amp * Math.sin(wt + phaseShift + (j / steps) * Math.PI * 6);
        ctx.lineTo(px, py);
      }
      ctx.strokeStyle = `rgba(30,100,200,${alpha.toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // ── Safe zones ───────────────────────────────────────────
    // Safe zones are on the world-X axis (left=P1, right=P2).
    // When rotated, world-X maps to screen-Y, so zones go top/bottom.
    const szW = tr(curr.config.safeZoneWidth);

    if (rotated) {
      // P2 safe zone at screen top (world-X = mapWidth, flipped)
      const p2z = ctx.createLinearGradient(gx, gy, gx, gy + szW);
      p2z.addColorStop(0, 'rgba(239,68,68,0.18)');
      p2z.addColorStop(1, 'rgba(239,68,68,0)');
      ctx.fillStyle = p2z;
      ctx.fillRect(gx, gy, gameW, szW);

      // P1 safe zone at screen bottom (world-X = 0, flipped)
      const p1zy = gy + gameH - szW;
      const p1z = ctx.createLinearGradient(gx, p1zy, gx, p1zy + szW);
      p1z.addColorStop(0, 'rgba(59,130,246,0)');
      p1z.addColorStop(1, 'rgba(59,130,246,0.18)');
      ctx.fillStyle = p1z;
      ctx.fillRect(gx, p1zy, gameW, szW);

      // Center divider (horizontal)
      ctx.setLineDash([6, 9]);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gx, gy + gameH / 2);
      ctx.lineTo(gx + gameW, gy + gameH / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // P2 safe zone at screen top (world-Y = 0, top)
      const p2z = ctx.createLinearGradient(gx, gy, gx, gy + szW);
      p2z.addColorStop(0, 'rgba(239,68,68,0.18)');
      p2z.addColorStop(1, 'rgba(239,68,68,0)');
      ctx.fillStyle = p2z;
      ctx.fillRect(gx, gy, gameW, szW);

      // P1 safe zone at screen bottom (world-Y = mapHeight, bottom)
      const p1zy = gy + gameH - szW;
      const p1z = ctx.createLinearGradient(gx, p1zy, gx, p1zy + szW);
      p1z.addColorStop(0, 'rgba(59,130,246,0)');
      p1z.addColorStop(1, 'rgba(59,130,246,0.18)');
      ctx.fillStyle = p1z;
      ctx.fillRect(gx, p1zy, gameW, szW);

      // Center divider (horizontal)
      ctx.setLineDash([6, 9]);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gx, gy + gameH / 2);
      ctx.lineTo(gx + gameW, gy + gameH / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore(); // end wave clip

    // ── Game viewport clip for gameplay elements ─────────────
    ctx.save();
    ctx.beginPath();
    ctx.rect(gx, gy, gameW, gameH);
    ctx.clip();

    // ────────────────────────────────────────────────────────
    // SHIP TRAILS
    // ────────────────────────────────────────────────────────
    ctx.lineCap = 'round';
    for (const [shipId, trail] of trailsRef.current) {
      if (trail.length < 2) continue;
      const ship = curr.ships.find((s) => s.id === shipId);
      if (!ship) continue;
      const c = ownerRGB(ship.owner);

      for (let i = 1; i < trail.length; i++) {
        const alpha = (i / trail.length) * 0.45;
        const lw = ((i / trail.length) * 2.5 + 0.5) * (effectiveScale / baseScale);
        ctx.beginPath();
        ctx.moveTo(toSX(trail[i - 1].x, trail[i - 1].y), toSY(trail[i - 1].x, trail[i - 1].y));
        ctx.lineTo(toSX(trail[i].x, trail[i].y), toSY(trail[i].x, trail[i].y));
        ctx.strokeStyle = rgba(c, alpha);
        ctx.lineWidth = Math.max(0.5, lw);
        ctx.stroke();
      }
    }
    ctx.lineCap = 'butt';

    // ────────────────────────────────────────────────────────
    // ISLANDS
    // ────────────────────────────────────────────────────────
    for (const island of curr.islands) {
      const ix = toSX(island.x, island.y);
      const iy = toSY(island.x, island.y);
      const captureR = tr(island.radius);
      const bodyR = Math.max(8, captureR * 0.42);

      // Resolve display color (with transition)
      let dc: RGB;
      const trans = islandTransRef.current.get(island.id);
      if (trans) {
        const tTrans = (now - trans.startTime) / trans.duration;
        if (tTrans >= 1) {
          islandTransRef.current.delete(island.id);
          dc = ownerRGB(island.owner);
        } else {
          dc = lerpRGB(trans.from, trans.to, tTrans);
        }
      } else {
        dc = ownerRGB(island.owner);
      }

      // Capture radius dashed ring
      ctx.beginPath();
      ctx.arc(ix, iy, captureR, 0, Math.PI * 2);
      ctx.setLineDash([5, 8]);
      ctx.strokeStyle = rgba(dc, 0.3);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      // Outer glow
      const glow = ctx.createRadialGradient(ix, iy, bodyR * 0.4, ix, iy, bodyR * 2.2);
      glow.addColorStop(0, rgba(dc, 0.22));
      glow.addColorStop(1, rgba(dc, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ix, iy, bodyR * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Island body
      const bodyGrad = ctx.createRadialGradient(
        ix - bodyR * 0.38,
        iy - bodyR * 0.38,
        bodyR * 0.04,
        ix,
        iy,
        bodyR,
      );
      bodyGrad.addColorStop(0, rgba(lighten(dc, 85)));
      bodyGrad.addColorStop(0.45, rgba(dc));
      bodyGrad.addColorStop(1, rgba(darken(dc, 45)));
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(ix, iy, bodyR, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = rgba(lighten(dc, 50), 0.75);
      ctx.lineWidth = 2;
      ctx.stroke();

      // ── Capture progress arc (animated fill ring) ──────────
      if (island.teamCapturing !== 'none' && island.captureProgress > 0) {
        const teamOwner = island.teamCapturing as Owner;
        const isEnemy = island.owner !== 'neutral' && island.owner !== teamOwner;
        const totalNeeded = isEnemy ? island.captureTurns * 2 : island.captureTurns;
        const progress = Math.min(island.captureProgress / totalNeeded, 1);
        const capC = ownerRGB(teamOwner);

        // Background track
        ctx.beginPath();
        ctx.arc(ix, iy, bodyR + 6, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(capC, 0.15);
        ctx.lineWidth = 4;
        ctx.stroke();

        // Animated fill arc
        const startAngle = -Math.PI / 2;
        ctx.beginPath();
        ctx.arc(ix, iy, bodyR + 6, startAngle, startAngle + progress * Math.PI * 2);
        ctx.strokeStyle = rgba(capC, 0.9);
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.lineCap = 'butt';

        // Pulse halo when neutralizing enemy island
        if (isEnemy && island.captureProgress <= island.captureTurns) {
          const pulse = 0.5 + 0.5 * Math.sin(now / 180);
          ctx.fillStyle = rgba(capC, 0.08 * pulse);
          ctx.beginPath();
          ctx.arc(ix, iy, captureR, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ── Island label (only in replay/debug mode) ────────
      if (showIslandIds) {
        const fontSize = Math.max(8, bodyR * 0.68);
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(island.id + 1), ix, iy);
      }

      // ── Island value indicator ("+N/tick" floating label) ──
      if (island.owner !== 'neutral') {
        const player = island.owner === 'player1' ? curr.player1 : curr.player2;
        const tickPts = player.lastTickPoints;
        const label = tickPts > 0 ? `+${tickPts}/tick` : '+0/tick';
        const floatY = iy - bodyR - 14 + Math.sin(now / 900 + island.id * 1.3) * 3;
        const valColor = lighten(ownerRGB(island.owner), 60);

        ctx.font = `bold 10px monospace`;
        ctx.fillStyle = rgba(valColor, 0.92);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        // Subtle shadow for readability
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 4;
        ctx.fillText(label, ix, floatY);
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
      }
    }

    // ────────────────────────────────────────────────────────
    // SHIPS — build prev-position map for interpolation
    // ────────────────────────────────────────────────────────
    const prevShipMap = new Map<number, Ship>();
    if (prev) for (const s of prev.ships) prevShipMap.set(s.id, s);

    function shipCanvasPos(ship: Ship): { sx: number; sy: number } {
      const p = prevShipMap.get(ship.id);
      const interp = p && p.alive && ship.alive;
      const sx = interp ? lerp(p!.x, ship.x, tInterp) : ship.x;
      const sy = interp ? lerp(p!.y, ship.y, tInterp) : ship.y;
      return { sx, sy };
    }

    const attackR = curr.config.attackRadius;
    const attackR2 = attackR * attackR;

    // Pass 1: combat-radius circles (behind ships)
    for (const ship of curr.ships) {
      if (!ship.alive) continue;
      const hasEnemy = curr.ships.some(
        (s) => s.alive && s.owner !== ship.owner && dist2(ship.x, ship.y, s.x, s.y) <= attackR2,
      );
      if (!hasEnemy) continue;
      const { sx, sy } = shipCanvasPos(ship);
      const c = ownerRGB(ship.owner);
      ctx.beginPath();
      ctx.arc(toSX(sx, sy), toSY(sx, sy), tr(attackR), 0, Math.PI * 2);
      ctx.strokeStyle = rgba(c, 0.2);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = rgba(c, 0.04);
      ctx.fill();
    }

    // Pass 2: glow + capturing ring
    const shipSize = Math.max(6, tr(9));
    for (const ship of curr.ships) {
      if (!ship.alive) continue;
      const { sx, sy } = shipCanvasPos(ship);
      const cx = toSX(sx, sy),
        cy = toSY(sx, sy);
      const c = ownerRGB(ship.owner);

      const glowR = shipSize * 2.8;
      const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      glowGrad.addColorStop(0, rgba(c, 0.38));
      glowGrad.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fill();

      if (ship.isCapturing) {
        const pulse = 0.45 + 0.35 * Math.sin(now / 300 + ship.id);
        ctx.beginPath();
        ctx.arc(cx, cy, shipSize + 6, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(c, pulse);
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Pass 2.5: combat pressure ring (red arc showing progress toward death)
    const killDelay = curr.config.combatKillDelay || 8;
    for (const ship of curr.ships) {
      if (!ship.alive || ship.combatPressure <= 0) continue;
      const { sx, sy } = shipCanvasPos(ship);
      const cx = toSX(sx, sy),
        cy = toSY(sx, sy);
      const progress = Math.min(ship.combatPressure / killDelay, 1);
      const alpha = 0.3 + progress * 0.7;
      const ringR = shipSize + 10;
      const startAngle = -Math.PI / 2;

      ctx.beginPath();
      ctx.arc(cx, cy, ringR, startAngle, startAngle + progress * Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 40, 40, ${alpha.toFixed(2)})`;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.lineCap = 'butt';
    }

    // Pass 3: ship hulls
    for (const ship of curr.ships) {
      const { sx, sy } = shipCanvasPos(ship);
      const cx = toSX(sx, sy),
        cy = toSY(sx, sy);
      const c = ownerRGB(ship.owner);

      if (ship.alive) {
        let angle = shipAngleRef.current.get(ship.id) ?? (ship.owner === 'player1' ? 0 : Math.PI);
        // When axes are swapped, screen angle = π/2 - world angle
        if (rotated) angle = -(Math.PI / 2 - angle);
        drawShip(ctx, cx, cy, shipSize, angle, c);
      } else if (ship.turnsToRevive > 0) {
        const alpha = ship.turnsToRevive / Math.max(1, curr.config.respawnDelay);
        const xSize = Math.max(4, tr(6));
        drawDeadShip(ctx, cx, cy, xSize, alpha, ship.owner);
      }
    }

    // ────────────────────────────────────────────────────────
    // STACKED SHIP INDICATORS — show count when ships overlap
    // ────────────────────────────────────────────────────────
    const stackThreshold = shipSize * 1.5; // pixel distance to consider "stacked"
    const aliveShips = curr.ships.filter((s) => s.alive);
    const counted = new Set<number>();
    for (let i = 0; i < aliveShips.length; i++) {
      if (counted.has(aliveShips[i].id)) continue;
      const si = aliveShips[i];
      const { sx: six, sy: siy } = shipCanvasPos(si);
      const cix = toSX(six, siy), ciy = toSY(six, siy);
      const stack = [si];
      for (let j = i + 1; j < aliveShips.length; j++) {
        if (counted.has(aliveShips[j].id)) continue;
        const sj = aliveShips[j];
        const { sx: sjx, sy: sjy } = shipCanvasPos(sj);
        const cjx = toSX(sjx, sjy), cjy = toSY(sjx, sjy);
        const dx = cix - cjx, dy = ciy - cjy;
        if (Math.sqrt(dx * dx + dy * dy) < stackThreshold) {
          stack.push(sj);
          counted.add(sj.id);
        }
      }
      counted.add(si.id);
      if (stack.length > 1) {
        // Count per owner
        const p1 = stack.filter((s) => s.owner === 'player1').length;
        const p2 = stack.filter((s) => s.owner === 'player2').length;
        const labels: { text: string; color: string; offsetX: number }[] = [];
        if (p1 > 0 && p2 > 0) {
          // Mixed stack — show both counts side by side
          labels.push({ text: String(p1), color: 'rgb(100,180,255)', offsetX: -6 });
          labels.push({ text: String(p2), color: 'rgb(255,100,100)', offsetX: 6 });
        } else {
          const color = p1 > 0 ? 'rgb(100,180,255)' : 'rgb(255,100,100)';
          labels.push({ text: String(stack.length), color, offsetX: 0 });
        }
        for (const lbl of labels) {
          const bx = cix + lbl.offsetX;
          const by = ciy - shipSize - 6;
          const fontSize = Math.max(9, shipSize * 0.7);
          ctx.font = `bold ${fontSize}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          // Background pill
          const tw = ctx.measureText(lbl.text).width + 6;
          const th = fontSize + 2;
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.beginPath();
          ctx.roundRect(bx - tw / 2, by - th, tw, th, 3);
          ctx.fill();
          // Text
          ctx.fillStyle = lbl.color;
          ctx.fillText(lbl.text, bx, by - 1);
        }
      }
    }

    // ────────────────────────────────────────────────────────
    // EXPLOSION PARTICLES
    // ────────────────────────────────────────────────────────
    for (const p of particlesRef.current) {
      const px = toSX(p.x, p.y);
      const py = toSY(p.x, p.y);
      const ps = p.size * effectiveScale * 0.12; // scale with zoom
      ctx.beginPath();
      ctx.arc(px, py, Math.max(1, ps), 0, Math.PI * 2);
      ctx.fillStyle = rgba(p.color, p.life * p.life);
      ctx.fill();
    }

    ctx.restore(); // end game-viewport clip

    // ── Game area border ──────────────────────────────────────
    ctx.strokeStyle = 'rgba(80, 140, 210, 0.28)';
    ctx.lineWidth = 2;
    ctx.strokeRect(gx, gy, gameW, gameH);

    // ── MINIMAP ───────────────────────────────────────────────
    drawMinimap(ctx, curr, w, h, now);

    ctx.restore(); // end dpr scale
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }, [mapWidth, mapHeight, drawMinimap]);

  // ── RAF loop ───────────────────────────────────────────────
  useEffect(() => {
    let running = true;
    function loop() {
      if (!running) return;
      draw();
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  // ── Responsive canvas via ResizeObserver + orientation detection ──
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const mapIsPortrait = mapHeight > mapWidth;

    function updateSize() {
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      const viewIsLandscape = w > h;

      // Only rotate on actual portrait viewports (phones) when map is landscape.
      // On desktop (landscape viewport), never rotate — always show top-to-bottom.
      // On portrait viewport with landscape map: rotate so map fills the screen.
      // On portrait viewport with portrait map: no rotation needed.
      const isPhonePortrait = !viewIsLandscape && w < 768;
      isRotatedRef.current = isPhonePortrait && !mapIsPortrait;

      dimsRef.current = { w, h, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [mapWidth, mapHeight]);

  // ── Render ─────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', minHeight: 360, display: 'block' }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}

// Props equality: re-render whenever gameState identity changes (every tick)
// or when layout dimensions change. mapWidth/mapHeight change only on restart.
export default memo(GameCanvas);
