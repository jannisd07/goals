/**
 * Constellation builder — converts sessions into a 3D node-graph structure.
 *
 * Each session becomes a "star" (node) positioned in 3D space.
 * Stars within the same goal are connected by MST (Minimum Spanning Tree) edges.
 * Longer sessions gravitate toward the center; shorter ones sit on the outer shell.
 *
 * Usage: const constellation = buildConstellation(sessions);
 */

import type { Session } from "../types";

// ---------- Types ----------

export interface ConstellationStar {
  x: number;
  y: number;
  z: number;
  radius: number;
  sessionId: string;
  goalId: string;
  durationMinutes: number;
  rating: number | null;
  startTime: string;
}

export interface ConstellationLine {
  aId: string;
  bId: string;
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
}

export interface Constellation {
  stars: ConstellationStar[];
  lines: ConstellationLine[];
}

// ---------- Seeded random ----------

function seededRng(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function hashGoal(gid: string): number {
  let h = 0;
  for (let i = 0; i < gid.length; i++) {
    h = Math.imul(31, h) + gid.charCodeAt(i) | 0;
  }
  return ((h >>> 0) % 1000) / 1000;
}

// ---------- Star generation ----------

function generateStar(
  session: Session,
  index: number,
  totalSessions: number,
): ConstellationStar {
  const rng = seededRng(session.id + session.start_time);
  const durationMinutes = Math.max(0, Math.floor((session.duration_seconds ?? 0) / 60));
  const rating =
    session.rating == null ? null : Math.max(1, Math.min(5, session.rating));

  // Radius: scales with duration (sqrt for natural feel)
  const clampedMin = Math.min(180, durationMinutes);
  const radius = 2.5 + Math.sqrt(clampedMin / 5) * 2.8;

  // Distance from center: inversely proportional to duration
  // Longer sessions = closer to center (bigger, more prominent)
  const maxDist = 200;
  const minDist = 12;
  const durNorm = Math.min(1, clampedMin / 90);
  const baseDist = maxDist - durNorm * (maxDist - minDist);
  const jitter = 0.8 + rng() * 0.6;
  const dist = baseDist * jitter;

  // Spherical direction: golden angle for even distribution
  const golden = Math.PI * (3 - Math.sqrt(5));
  const theta = golden * index + rng() * 0.4;
  const phi = Math.acos(1 - 2 * ((index + rng() * 0.4) / Math.max(1, totalSessions)));

  let x = dist * Math.sin(phi) * Math.cos(theta);
  let y = dist * Math.sin(phi) * Math.sin(theta);
  let z = dist * Math.cos(phi);

  // Goal cluster nudge — stars of the same goal gravitate together
  const gh = hashGoal(session.goal_id);
  const gTheta = gh * Math.PI * 2;
  const gPhi = 0.4 + gh * 0.9;
  const nudge = 35 + Math.min(totalSessions, 100) * 0.4;
  x += Math.sin(gPhi) * Math.cos(gTheta) * nudge;
  y += Math.sin(gPhi) * Math.sin(gTheta) * nudge;
  z += Math.cos(gPhi) * nudge;

  return {
    x,
    y,
    z,
    radius,
    sessionId: session.id,
    goalId: session.goal_id,
    durationMinutes,
    rating,
    startTime: session.start_time,
  };
}

// ---------- Overlap resolution ----------

function resolveOverlaps(stars: ConstellationStar[], iterations: number): void {
  const padding = 5;

  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;

    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const a = stars[i];
        const b = stars[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
        const minD = a.radius + b.radius + padding;

        if (d < minD) {
          const overlap = (minD - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          const nz = dz / d;

          const totalR = a.radius + b.radius || 1;
          const aWeight = b.radius / totalR;
          const bWeight = a.radius / totalR;

          a.x -= nx * overlap * aWeight;
          a.y -= ny * overlap * aWeight;
          a.z -= nz * overlap * aWeight;
          b.x += nx * overlap * bWeight;
          b.y += ny * overlap * bWeight;
          b.z += nz * overlap * bWeight;

          moved = true;
        }
      }
    }

    if (!moved) break;
  }
}

// ---------- MST lines per goal ----------

function buildLines(stars: ConstellationStar[]): ConstellationLine[] {
  const goals: Record<string, ConstellationStar[]> = {};
  for (const s of stars) {
    if (!goals[s.goalId]) goals[s.goalId] = [];
    goals[s.goalId].push(s);
  }

  const lines: ConstellationLine[] = [];

  for (const group of Object.values(goals)) {
    if (group.length < 2) continue;

    // Prim's MST
    const inTree = new Set([0]);
    const out = new Set(group.map((_, i) => i));
    out.delete(0);

    while (out.size > 0) {
      let bestDist = Infinity;
      let bestFrom = 0;
      let bestTo = 0;

      for (const fi of inTree) {
        for (const ti of out) {
          const dx = group[fi].x - group[ti].x;
          const dy = group[fi].y - group[ti].y;
          const dz = group[fi].z - group[ti].z;
          const d = dx * dx + dy * dy + dz * dz;
          if (d < bestDist) {
            bestDist = d;
            bestFrom = fi;
            bestTo = ti;
          }
        }
      }

      inTree.add(bestTo);
      out.delete(bestTo);

      const a = group[bestFrom];
      const b = group[bestTo];
      lines.push({
        aId: a.sessionId,
        bId: b.sessionId,
        ax: a.x,
        ay: a.y,
        az: a.z,
        bx: b.x,
        by: b.y,
        bz: b.z,
      });
    }
  }

  return lines;
}

// ---------- Public API ----------

/**
 * Build a complete constellation from a list of sessions.
 * Deterministic: same sessions always produce the same result.
 */
export function buildConstellation(sessions: Session[]): Constellation {
  if (sessions.length === 0) return { stars: [], lines: [] };

  const stars = sessions.map((s, i) => generateStar(s, i, sessions.length));
  resolveOverlaps(stars, 80);
  const lines = buildLines(stars);

  return { stars, lines };
}

// ---------- 3D Projection ----------

export interface Projected {
  x: number;
  y: number;
  scale: number;
  z: number;
}

export function projectPoint(
  px: number,
  py: number,
  pz: number,
  camAz: number,
  camEl: number,
  camZoom: number,
  centerX: number,
  centerY: number,
): Projected {
  const camDist = 480;

  // Rotate Y
  const cosA = Math.cos(camAz);
  const sinA = Math.sin(camAz);
  const rx = px * cosA + pz * sinA;
  const ry = py;
  const rz = -px * sinA + pz * cosA;

  // Rotate X
  const cosE = Math.cos(camEl);
  const sinE = Math.sin(camEl);
  const rx2 = rx;
  const ry2 = ry * cosE - rz * sinE;
  const rz2 = ry * sinE + rz * cosE;

  const d = camDist / camZoom;
  const persp = d / (d + rz2 + 300);

  return {
    x: centerX + rx2 * persp,
    y: centerY + ry2 * persp,
    scale: persp,
    z: rz2,
  };
}
