import { ACTOR_SIZE, advanceActor, aimJump, keepInBounds, type Actor, type Platform } from "./mascot-physics";

export type MascotId = "ben" | "gwen" | "kevin";
export type Behavior = "idle" | "run" | "jump" | "slide" | "roll" | "held" | "angry" | "happy" | "fight";
export type EncounterKind = "friendly" | "spar" | "trio";
export type EncounterPhase = "chat" | "fight" | "apology" | "play";
export const MASCOT_IDS: MascotId[] = ["ben", "gwen", "kevin"];
export const MASCOT_PROFILES = {
  ben: { name: "Ben", color: "#c1f76a", angry: "Ei! O Omnitrix não é brinquedo! 😤" },
  gwen: { name: "Gwen", color: "#49d6f5", angry: "Ei! Me coloca no chão! 😤" },
  kevin: { name: "Kevin", color: "#bc91ff", angry: "Tá me provocando? 😤" },
};
export type Mascot = {
  id: MascotId; actor: Actor; behavior: Behavior; face: number; held: boolean;
  angryUntil: number; nextAction: number; actionNumber: number; bubble: string;
};
type Anchor = { x: number; y: number; targetX: number };
export type Encounter = {
  kind: EncounterKind; phase: EncounterPhase; started: number;
  members: MascotId[]; anchors: Partial<Record<MascotId, Anchor>>;
};
export type MascotWorld = {
  agents: Record<MascotId, Mascot>; time: number; encounter: Encounter | null;
  nextEncounterAt: number; nextMeetAt: number; nextMeetKind: EncounterKind; meeting: EncounterKind | null;
};
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const close = (a: Mascot, b: Mascot, radius: number) =>
  Math.abs(a.actor.x - b.actor.x) <= radius && Math.abs(a.actor.y - b.actor.y) <= 52;
const available = (w: MascotWorld, id: MascotId) => !w.agents[id].held && w.agents[id].angryUntil <= w.time;
const membersFor = (kind: EncounterKind): MascotId[] =>
  kind === "trio" ? ["ben", "gwen", "kevin"] : kind === "friendly" ? ["ben", "gwen"] : ["ben", "kevin"];

export function createMascotWorld(width: number, height: number): MascotWorld {
  const maxX = Math.max(0, width - ACTOR_SIZE);
  const xs = [maxX * .18, Math.min(maxX, maxX * .18 + 90), maxX * .85];
  const agents = {} as Record<MascotId, Mascot>;
  MASCOT_IDS.forEach((id, i) => {
    agents[id] = {
      id, actor: { x: xs[i], y: height - ACTOR_SIZE - 10, vx: i === 1 ? -55 : 70 + i * 12, vy: 0, grounded: true },
      behavior: "run", face: i === 1 ? -1 : 1, held: false, angryUntil: 0,
      nextAction: 3000 + i * 700, actionNumber: i, bubble: "",
    };
  });
  return { agents, time: 0, encounter: null, nextEncounterAt: 500, nextMeetAt: 12000, nextMeetKind: "friendly", meeting: null };
}

export function detectEncounter(world: MascotWorld): EncounterKind | null {
  const { ben, gwen, kevin } = world.agents;
  const trioNear = close(ben, gwen, 165) && close(ben, kevin, 165) && close(gwen, kevin, 165);
  if (trioNear && MASCOT_IDS.every(id => available(world, id))) return "trio";
  if (!available(world, "ben")) return null;
  if (available(world, "gwen") && close(ben, gwen, 102) && ben.actor.grounded && gwen.actor.grounded) return "friendly";
  // Gwen's presence prevents a two-person fight, even while she's being held.
  if (available(world, "kevin") && close(ben, kevin, 102) && !close(ben, gwen, 165)
    && ben.actor.grounded && kevin.actor.grounded) return "spar";
  return null;
}

function startEncounter(world: MascotWorld, kind: EncounterKind, width: number) {
  const members = membersFor(kind);
  const maxX = Math.max(0, width - ACTOR_SIZE), spacing = Math.min(72, maxX / Math.max(1, members.length - 1));
  const center = members.reduce((sum, id) => sum + world.agents[id].actor.x, 0) / members.length;
  const left = clamp(center - spacing * (members.length - 1) / 2, 0, Math.max(0, maxX - spacing * (members.length - 1)));
  const anchors: Encounter["anchors"] = {};
  members.forEach((id, i) => {
    const a = world.agents[id];
    anchors[id] = { x: a.actor.x, y: a.actor.y, targetX: left + i * spacing };
    a.actor.vx = 0; a.actor.vy = 0; a.face = i === 0 ? 1 : -1; a.bubble = "";
  });
  world.encounter = { kind, phase: kind === "spar" ? "fight" : kind === "trio" ? "play" : "chat", started: world.time, members, anchors };
  world.meeting = null;
}

function finishEncounter(world: MascotWorld) {
  const e = world.encounter; if (!e) return;
  e.members.forEach((id, i) => {
    const a = world.agents[id];
    a.bubble = ""; a.behavior = "run"; a.actor.vx = i === 0 ? -100 : 100;
    a.actor.vy = 0; a.actor.grounded = false; a.nextAction = world.time + 1200 + i * 500;
  });
  world.nextMeetKind = e.kind === "friendly" ? "spar" : e.kind === "spar" ? "trio" : "friendly";
  world.encounter = null; world.meeting = null;
  world.nextEncounterAt = world.time + 6500; world.nextMeetAt = world.time + 4500;
}

export function interruptEncounter(world: MascotWorld, id: MascotId) {
  if (world.encounter?.members.includes(id)) finishEncounter(world);
  world.meeting = null;
  world.nextEncounterAt = Math.max(world.nextEncounterAt, world.time + 1200);
  world.nextMeetAt = world.time + 5000;
}

export function grabMascot(world: MascotWorld, id: MascotId) {
  interruptEncounter(world, id);
  const a = world.agents[id]; a.held = true; a.behavior = "held"; a.bubble = "";
  a.angryUntil = 0; a.actor.vx = 0; a.actor.vy = 0; a.actor.grounded = false;
}
export function dragMascot(world: MascotWorld, id: MascotId, x: number, y: number, velocity: number, width: number, height: number) {
  const a = world.agents[id];
  a.actor = keepInBounds({ ...a.actor, x, y, vx: velocity, vy: 0, grounded: false }, width, height);
}
export function irritateMascot(world: MascotWorld, id: MascotId) {
  interruptEncounter(world, id);
  const a = world.agents[id]; a.held = false; a.angryUntil = world.time + 1900;
  a.behavior = "angry"; a.actor.vx = 0; a.bubble = MASCOT_PROFILES[id].angry;
}
export function releaseMascot(world: MascotWorld, id: MascotId, velocity: number, moved: boolean) {
  const a = world.agents[id]; a.held = false;
  if (!moved) { irritateMascot(world, id); return; }
  a.actor.vx = clamp(velocity, -260, 260); a.actor.vy = -75; a.actor.grounded = false;
  a.behavior = "jump"; a.nextAction = world.time + 1600; a.bubble = "";
}

function updateEncounter(world: MascotWorld, width: number, height: number) {
  const e = world.encounter; if (!e) return;
  const t = world.time - e.started;
  const duration = e.kind === "spar" ? 7500 : 6400;
  if (t >= duration) { finishEncounter(world); return; }
  e.phase = e.kind === "spar" ? (t < 3000 ? "fight" : t < 6200 ? "apology" : "play") : e.kind === "trio" ? "play" : "chat";
  e.members.forEach((id, i) => {
    const a = world.agents[id], anchor = e.anchors[id]!;
    const hop = e.phase === "fight" || e.phase === "apology" ? 0 : Math.max(0, Math.sin(t / 170 + i * .8)) * 30;
    const sway = e.phase === "fight" ? Math.sin(t / 85 + i * Math.PI) * 6 : e.phase === "apology" ? 0 : Math.sin(t / 180 + i) * 4;
    const settle = Math.min(1, t / 500);
    a.actor = keepInBounds({ ...a.actor, x: anchor.x + (anchor.targetX - anchor.x) * settle + sway, y: anchor.y - hop, vx: 0, vy: 0, grounded: hop < .1 }, width, height);
    a.behavior = e.phase === "fight" ? "fight" : e.phase === "apology" ? "idle" : hop > 3 ? "happy" : e.kind === "trio" && Math.floor(t / 1000 + i) % 3 === 2 ? "roll" : "idle";
    a.bubble = "";
  });
  let lines: [MascotId, string][];
  let speechTime = t;
  if (e.phase === "fight") lines = [["ben", "Tá me provocando, Kevin?"], ["kevin", "Vem, Tennyson! 👊"]];
  else if (e.phase === "apology") {
    lines = [["ben", "Foi mal, Kevin. 🤝"], ["kevin", "Foi mal também, Ben. 🤝"]];
    speechTime -= 3000;
  } else if (e.kind === "spar") { lines = [["ben", "Trégua? 😄"], ["kevin", "Fechado! 😎"]]; speechTime -= 6200; }
  else if (e.kind === "friendly") lines = [["ben", "Gwen! Bora pular? 😄"], ["gwen", "Bora, primo! 😄"], ["ben", "Viu esse salto? 😎"], ["gwen", "Convencido! 😂"]];
  else lines = [["ben", "Time completo! 😄"], ["gwen", "Corrida até o título? 🏁"], ["kevin", "Sem trapacear! 😂"], ["ben", "Boraaaa! ⭐"]];
  const [speaker, line] = lines[Math.floor(speechTime / 1400) % lines.length];
  world.agents[speaker].bubble = line;
}

function seekMeeting(world: MascotWorld, a: Mascot, width: number, height: number, platforms: Platform[], kind: EncounterKind = world.meeting!) {
  const maxX = Math.max(0, width - ACTOR_SIZE);
  const members = membersFor(kind);
  let target: number;
  if (kind === "trio") target = maxX / 2 + (members.indexOf(a.id) - 1) * Math.min(72, maxX / 2);
  else target = members.includes(a.id) ? 16 + members.indexOf(a.id) * 78 : maxX - 8;
  target = clamp(target, 0, maxX);
  const onTitle = a.actor.grounded && a.actor.y + ACTOR_SIZE < height - 14;
  const platform = onTitle ? platforms.find(p => Math.abs(p.top - a.actor.y - ACTOR_SIZE) < 4 && a.actor.x + ACTOR_SIZE / 2 >= p.left && a.actor.x + ACTOR_SIZE / 2 <= p.right) : undefined;
  if (platform) {
    const center = a.actor.x + ACTOR_SIZE / 2;
    a.actor.vx = center - platform.left < platform.right - center ? -140 : 140;
  } else if (a.actor.vy > 0 && platforms.some(p => a.actor.y + ACTOR_SIZE > p.top && a.actor.y + ACTOR_SIZE < p.top + 16
    && Math.min(Math.abs(a.actor.x + ACTOR_SIZE / 2 - p.left), Math.abs(a.actor.x + ACTOR_SIZE / 2 - p.right)) < 24)) {
    // Continue off the edge until clear of the title, rather than immediately landing on it again.
    a.actor.vx = Math.sign(a.actor.vx || 1) * 140;
  } else {
    const dx = target - a.actor.x;
    a.actor.vx = Math.abs(dx) < 3 ? 0 : Math.sign(dx) * Math.min(170, Math.abs(dx) * 5);
  }
  a.behavior = a.actor.grounded ? Math.abs(a.actor.vx) < 1 ? "idle" : "run" : "jump";
}

export function stepMascotWorld(world: MascotWorld, delta: number, width: number, height: number, platforms: Platform[]) {
  const dt = clamp(delta, 0, .04); world.time += dt * 1000;
  // A third free character joining a pair always turns the scene into group play.
  if (world.encounter && world.encounter.kind !== "trio" && detectEncounter(world) === "trio") startEncounter(world, "trio", width);
  if (!world.encounter && !world.meeting && world.time >= world.nextMeetAt && MASCOT_IDS.every(id => available(world, id))) world.meeting = world.nextMeetKind;
  MASCOT_IDS.forEach((id, i) => {
    const a = world.agents[id];
    if (a.held || world.encounter?.members.includes(id)) return;
    if (world.time < a.angryUntil) {
      a.behavior = "angry"; a.actor.vx = 0; a.bubble = MASCOT_PROFILES[id].angry;
    } else {
      a.bubble = "";
      if (a.behavior === "angry") { a.behavior = "idle"; a.nextAction = world.time + 300; }
      if (world.encounter) seekMeeting(world, a, width, height, platforms, world.encounter.kind);
      else if (world.meeting) seekMeeting(world, a, width, height, platforms);
      else if (world.time >= a.nextAction && a.actor.grounded) {
        a.actionNumber++; a.nextAction = world.time + 2300 + i * 170;
        const n = a.actionNumber % 5;
        if (n === 1 || n === 4) {
          const targets = platforms.filter(p => a.actor.y + ACTOR_SIZE - p.top >= 0 && a.actor.y + ACTOR_SIZE - p.top < 500)
            .sort((p, q) => Math.abs((p.left + p.right) / 2 - a.actor.x - ACTOR_SIZE / 2) - Math.abs((q.left + q.right) / 2 - a.actor.x - ACTOR_SIZE / 2));
          const target = targets[(a.actionNumber + i) % Math.max(1, Math.min(5, targets.length))];
          a.actor = target ? aimJump(a.actor, target) : { ...a.actor, grounded: false, vy: -420, vx: a.actor.vx || 110 };
          a.behavior = "jump";
        } else {
          a.behavior = n === 2 ? "slide" : n === 3 ? "roll" : "run";
          a.actor.vx = (a.actionNumber % 2 ? 1 : -1) * (n === 2 ? 170 : 100);
        }
      }
    }
    a.actor = advanceActor(a.actor, dt, width, height, platforms);
    if (a.actor.grounded && a.behavior === "jump") a.behavior = "run";
    if (Math.abs(a.actor.vx) > 1) a.face = a.actor.vx < 0 ? -1 : 1;
  });
  if (world.encounter) updateEncounter(world, width, height);
  else if (world.time >= world.nextEncounterAt) {
    const kind = detectEncounter(world);
    // During an automatic rendezvous, let the friends separate before beginning the chosen scene.
    if (kind && (!world.meeting || kind === world.meeting)) { startEncounter(world, kind, width); updateEncounter(world, width, height); }
  }
  return world;
}
