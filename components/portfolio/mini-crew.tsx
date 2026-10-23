"use client";
import { useEffect, useRef, type CSSProperties, type PointerEvent } from "react";
import { ACTOR_SIZE, keepInBounds, type Platform } from "@/lib/mascot-physics";
import {
  MASCOT_IDS, MASCOT_PROFILES, createMascotWorld, stepMascotWorld,
  grabMascot, dragMascot, releaseMascot, irritateMascot,
  type MascotId, type MascotWorld,
} from "@/lib/mascot-world";

type Drag = { pointer: number; startX: number; startY: number; offsetX: number; offsetY: number; lastX: number; lastTime: number; velocity: number; moved: boolean };
export default function MiniCrew({ enabled }: { enabled: boolean }) {
  const world = useRef<MascotWorld | null>(null);
  const buttons = useRef<Partial<Record<MascotId, HTMLButtonElement | null>>>({});
  const bubbles = useRef<Partial<Record<MascotId, HTMLSpanElement | null>>>({});
  const drags = useRef<Partial<Record<MascotId, Drag>>>({});
  const calmTimers = useRef<Partial<Record<MascotId, ReturnType<typeof setTimeout>>>>({});
  const status = useRef<HTMLSpanElement>(null);
  const draw = () => {
    const w = world.current; if (!w) return;
    MASCOT_IDS.forEach(id => {
      const a = w.agents[id], el = buttons.current[id]; if (!el) return;
      const kind = a.held ? "held" : !enabled && a.behavior !== "angry" ? "idle" : a.behavior;
      const frame = kind === "held" ? 6 : kind === "angry" || kind === "fight" ? enabled ? 6 + Math.floor(w.time / 160) % 2 : 7 : kind === "jump" || kind === "happy" ? 3 : kind === "slide" ? 4 : kind === "roll" ? 5 : kind === "run" ? 1 + Math.floor(w.time / 120) % 2 : 0;
      const rotation = kind === "roll" && enabled ? (w.time / 4) % 360 : kind === "held" ? -6 : 0;
      const stomp = kind === "angry" && enabled ? Math.sin(w.time / 65) * 2 : 0;
      el.style.transform = "translate3d(" + Math.round(a.actor.x) + "px," + Math.round(a.actor.y + stomp) + "px,0)";
      el.style.setProperty("--sprite-x", (frame % 4) * 100 / 3 + "%");
      el.style.setProperty("--sprite-y", Math.floor(frame / 4) * 100 + "%");
      el.style.setProperty("--mascot-face", String(a.face));
      el.style.setProperty("--mascot-turn", rotation + "deg");
      el.style.setProperty("--bubble-left", Math.max(8 - a.actor.x, Math.min(-28, window.innerWidth - 140 - a.actor.x)) + "px");
      el.dataset.behavior = kind;
      el.dataset.ready = "true";
      el.dataset.social = w.encounter?.members.includes(id) ? w.encounter.phase : "";
      const bubble = bubbles.current[id];
      if (bubble) { if (bubble.textContent !== a.bubble) bubble.textContent = a.bubble; bubble.hidden = !a.bubble; }
    });
    const e = w.encounter;
    const live = !e ? "" : e.kind === "friendly" ? "Ben e Gwen pulam e conversam felizes." : e.kind === "trio" ? "Ben, Gwen e Kevin brincam juntos." : e.phase === "fight" ? "Ben e Kevin brigam de brincadeira." : e.phase === "apology" ? "Ben e Kevin pedem desculpas um ao outro." : "Ben e Kevin fizeram as pazes.";
    if (status.current && status.current.textContent !== live) status.current.textContent = live;
  };
  const clearCalm = (id: MascotId) => { if (calmTimers.current[id]) clearTimeout(calmTimers.current[id]); delete calmTimers.current[id]; };
  const calmWhenPaused = (id: MascotId) => {
    clearCalm(id);
    calmTimers.current[id] = setTimeout(() => {
      const a = world.current?.agents[id]; if (!a || a.held) return;
      a.angryUntil = 0; a.behavior = "idle"; a.bubble = ""; draw();
    }, 1950);
  };
  useEffect(() => {
    world.current ??= createMascotWorld(window.innerWidth, window.innerHeight);
    let frame = 0, lastTime = 0, lastScan = 0;
    let platforms: Platform[] = [];
    const scan = () => {
      platforms = [...document.querySelectorAll(".hero-letter, .section-heading h2, .closing h2")]
        .map(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top }; })
        .filter(p => p.top > 105 && p.top < window.innerHeight - 60 && p.right > 0 && p.left < window.innerWidth && p.right - p.left > 4);
    };
    const resize = () => {
      scan();
      const w = world.current!;
      MASCOT_IDS.forEach(id => { w.agents[id].actor = keepInBounds(w.agents[id].actor, window.innerWidth, window.innerHeight); });
      // End a scene after viewport changes so old anchors cannot push actors outside the new viewport.
      if (w.encounter) {
        const actors = w.encounter.members;
        w.encounter = null; w.nextEncounterAt = w.time + 2000; w.nextMeetAt = w.time + 4000;
        actors.forEach(id => { const a = w.agents[id]; a.behavior = "idle"; a.bubble = ""; a.actor.vy = 0; a.actor.grounded = false; });
      }
      draw();
    };
    scan(); resize();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", scan, { passive: true });
    if (enabled) {
      const tick = (now: number) => {
        if (now - lastScan > 900) { scan(); lastScan = now; }
        stepMascotWorld(world.current!, lastTime ? (now - lastTime) / 1000 : 1 / 60, window.innerWidth, window.innerHeight, platforms);
        lastTime = now; draw(); frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    } else {
      MASCOT_IDS.forEach(id => { if (world.current!.agents[id].behavior === "angry") calmWhenPaused(id); });
    }
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize); window.removeEventListener("scroll", scan);
      MASCOT_IDS.forEach(clearCalm);
    };
    // The animation loop keeps its current world in refs and restarts only for the effects setting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const angry = (id: MascotId) => { if (!world.current) return; clearCalm(id); irritateMascot(world.current, id); if (!enabled) calmWhenPaused(id); draw(); };
  const down = (id: MascotId, e: PointerEvent<HTMLButtonElement>) => {
    const w = world.current; if (!w || !e.isPrimary || e.button !== 0) return;
    e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); clearCalm(id);
    const a = w.agents[id].actor;
    drags.current[id] = { pointer: e.pointerId, startX: e.clientX, startY: e.clientY, offsetX: e.clientX - a.x, offsetY: e.clientY - a.y, lastX: e.clientX, lastTime: performance.now(), velocity: 0, moved: false };
    grabMascot(w, id); draw();
  };
  const move = (id: MascotId, e: PointerEvent<HTMLButtonElement>) => {
    const d = drags.current[id], w = world.current; if (!w || !d || d.pointer !== e.pointerId) return;
    if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 6) d.moved = true;
    if (!d.moved) return;
    const now = performance.now();
    d.velocity = Math.max(-260, Math.min(260, (e.clientX - d.lastX) / Math.max(.016, (now - d.lastTime) / 1000)));
    d.lastX = e.clientX; d.lastTime = now;
    dragMascot(w, id, e.clientX - d.offsetX, e.clientY - d.offsetY, d.velocity, window.innerWidth, window.innerHeight); draw();
  };
  const up = (id: MascotId, e: PointerEvent<HTMLButtonElement>) => {
    const d = drags.current[id], w = world.current; if (!w || !d || d.pointer !== e.pointerId) return;
    delete drags.current[id];
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    releaseMascot(w, id, d.velocity, d.moved);
    if (!d.moved && !enabled) calmWhenPaused(id);
    draw();
  };
  const cancel = (id: MascotId) => {
    if (!drags.current[id] || !world.current) return;
    delete drags.current[id]; releaseMascot(world.current, id, 0, true); draw();
  };
  return <div className="mascot-crew" role="group" aria-label="Mini Ben, Gwen e Kevin">
    {MASCOT_IDS.map(id => <button key={id} ref={el => { buttons.current[id] = el; }} className="mini-mascot" data-mascot={id} data-behavior="idle"
      style={{ "--mascot-color": MASCOT_PROFILES[id].color } as CSSProperties}
      aria-label={"Mini " + MASCOT_PROFILES[id].name + ": arraste para pegar; clique ou pressione Enter para irritar"}
      title={MASCOT_PROFILES[id].name + " — arraste para pegar ou aproximar dos amigos"}
      onPointerDown={e => down(id, e)} onPointerMove={e => move(id, e)} onPointerUp={e => up(id, e)}
      onPointerCancel={() => cancel(id)} onLostPointerCapture={() => cancel(id)} onClick={e => { if (e.detail === 0) angry(id); }}>
      <span ref={el => { bubbles.current[id] = el; }} className="mascot-bubble" aria-hidden="true" hidden/>
      <span className="mascot-sprite" aria-hidden="true"/>
      <span className="mascot-spark" aria-hidden="true">✦</span>
    </button>)}
    <span ref={status} className="sr-only" aria-live="polite" aria-atomic="true"/>
  </div>;
}
