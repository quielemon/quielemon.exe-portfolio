export type Platform = { left: number; right: number; top: number };
export type Actor = { x: number; y: number; vx: number; vy: number; grounded: boolean };
export const ACTOR_SIZE = 72;
export const GRAVITY = 1100;
export function keepInBounds(actor: Actor, width: number, height: number): Actor {
  return { ...actor, x: Math.max(0, Math.min(Math.max(0, width - ACTOR_SIZE), actor.x)), y: Math.max(80, Math.min(Math.max(80, height - ACTOR_SIZE - 10), actor.y)) };
}
export function advanceActor(actor: Actor, delta: number, width: number, height: number, platforms: Platform[]): Actor {
  const dt = Math.max(0, Math.min(delta, 0.04));
  const next = { ...actor, vy: actor.vy + GRAVITY * dt, grounded: false };
  next.x += next.vx * dt;
  next.y += next.vy * dt;
  const maxX = Math.max(0, width - ACTOR_SIZE);
  if (next.x < 0 || next.x > maxX) { next.x = Math.max(0, Math.min(maxX, next.x)); next.vx *= -1; }
  if (next.y < 80) { next.y = 80; next.vy = Math.max(0, next.vy); }
  const previousFeet = actor.y + ACTOR_SIZE;
  const feet = next.y + ACTOR_SIZE;
  const surfaces = [...platforms, { left: -1, right: width + 1, top: height - 10 }].sort((a, b) => a.top - b.top);
  if (next.vy >= 0) {
    for (const p of surfaces) {
      const center = next.x + ACTOR_SIZE / 2;
      if (center >= p.left && center <= p.right && previousFeet <= p.top + 3 && feet >= p.top) {
        next.y = p.top - ACTOR_SIZE; next.vy = 0; next.grounded = true; break;
      }
    }
  }
  if (next.y > height - ACTOR_SIZE - 10) { next.y = Math.max(80, height - ACTOR_SIZE - 10); next.vy = 0; next.grounded = true; }
  return next;
}
export function aimJump(actor: Actor, target: Platform): Actor {
  const rise = Math.max(0, actor.y + ACTOR_SIZE - target.top);
  const vy = -Math.sqrt(2 * GRAVITY * (rise + 65));
  const duration = (-vy + Math.sqrt(Math.max(0, vy * vy - 2 * GRAVITY * rise))) / GRAVITY;
  const desiredX = (target.left + target.right) / 2 - ACTOR_SIZE / 2;
  return { ...actor, grounded: false, vy, vx: Math.max(-300, Math.min(300, (desiredX - actor.x) / duration)) };
}
