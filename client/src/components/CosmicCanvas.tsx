import { useEffect, useRef, useState } from "react";
import {
  Application,
  Container,
  FederatedPointerEvent,
  Graphics,
  Rectangle,
  Text,
} from "pixi.js";
import {
  PLAYER_RADIUS,
  PROXIMITY_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "@virtual-cosmos/shared";
import type { Player } from "../types";

type Props = {
  players: Map<string, Player>;
  selfId: string | null;
  linkedPeerId: string | null;
  onWorldClick?: (x: number, y: number) => void;
};

const LERP = 0.2;
const NAME_STYLE = {
  fontFamily: "DM Sans, Outfit, Segoe UI, system-ui, sans-serif",
  fontSize: 12,
  fontWeight: "600" as const,
  fill: 0xe2e8f0,
  dropShadow: {
    alpha: 0.85,
    angle: Math.PI / 2,
    blur: 3,
    color: 0x000000,
    distance: 0,
  },
};

export function CosmicCanvas({ players, selfId, linkedPeerId, onWorldClick }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const playersRootRef = useRef<Container | null>(null);
  const proximityGfxRef = useRef<Graphics | null>(null);
  const linkLineGfxRef = useRef<Graphics | null>(null);
  const playerRootsRef = useRef<Map<string, Container>>(new Map());
  const targetsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const smoothRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const [ready, setReady] = useState(false);
  const clickRef = useRef(onWorldClick);
  clickRef.current = onWorldClick;

  const selfIdRef = useRef(selfId);
  const linkedPeerIdRef = useRef(linkedPeerId);
  selfIdRef.current = selfId;
  linkedPeerIdRef.current = linkedPeerId;

  useEffect(() => {
    const m = targetsRef.current;
    const smooth = smoothRef.current;
    for (const id of [...m.keys()]) {
      if (!players.has(id)) {
        m.delete(id);
        smooth.delete(id);
      }
    }
    players.forEach((p, id) => {
      m.set(id, { x: p.x, y: p.y });
    });
  }, [players]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    const app = new Application();

    const syncLayout = () => {
      const world = worldRef.current;
      if (!world || !app.renderer) return;
      const w = app.renderer.width;
      const h = app.renderer.height;
      const s = Math.min(w / WORLD_WIDTH, h / WORLD_HEIGHT) * 0.92;
      world.scale.set(s);
      world.position.set((w - WORLD_WIDTH * s) / 2, (h - WORLD_HEIGHT * s) / 2);
    };

    const tick = () => {
      const world = worldRef.current;
      const playersRoot = playersRootRef.current;
      const proximityGfx = proximityGfxRef.current;
      const linkLineGfx = linkLineGfxRef.current;
      if (!world || !playersRoot || !proximityGfx || !linkLineGfx) return;

      const targets = targetsRef.current;
      const smooth = smoothRef.current;
      const sid = selfIdRef.current;
      const lid = linkedPeerIdRef.current;

      for (const [id, t] of targets) {
        let s = smooth.get(id);
        if (!s) {
          smooth.set(id, { x: t.x, y: t.y });
          s = smooth.get(id)!;
        }
        if (id === sid) {
          s.x = t.x;
          s.y = t.y;
        } else {
          s.x += (t.x - s.x) * LERP;
          s.y += (t.y - s.y) * LERP;
        }
      }

      for (const [id, root] of playerRootsRef.current) {
        const s = smooth.get(id);
        if (s) {
          root.position.set(s.x, s.y);
        }
      }

      proximityGfx.clear();
      linkLineGfx.clear();

      if (sid) {
        const selfSmooth = smooth.get(sid);
        if (selfSmooth) {
          proximityGfx.circle(selfSmooth.x, selfSmooth.y, PROXIMITY_RADIUS);
          proximityGfx.stroke({ width: 1.5, color: 0x5eead4, alpha: 0.22 });
        }

        if (lid) {
          const peerSmooth = smooth.get(lid);
          if (peerSmooth && selfSmooth) {
            linkLineGfx.moveTo(selfSmooth.x, selfSmooth.y);
            linkLineGfx.lineTo(peerSmooth.x, peerSmooth.y);
            linkLineGfx.stroke({ width: 2, color: 0x5eead4, alpha: 0.35 });
          }
        }
      }
    };

    (async () => {
      await app.init({
        background: 0x0a0c10,
        antialias: true,
        resizeTo: host,
        resolution: typeof window !== "undefined" ? window.devicePixelRatio : 1,
        autoDensity: true,
      });
      if (cancelled) {
        app.destroy(true);
        return;
      }
      host.appendChild(app.canvas);
      appRef.current = app;
      app.stage.eventMode = "static";

      const world = new Container();
      worldRef.current = world;
      world.eventMode = "static";
      world.cursor = "pointer";
      world.hitArea = new Rectangle(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      const onPointerDown = (e: FederatedPointerEvent) => {
        const local = world.toLocal(e.global);
        clickRef.current?.(local.x, local.y);
      };
      world.on("pointerdown", onPointerDown);
      app.stage.addChild(world);

      const grid = new Graphics();
      grid.eventMode = "none";
      grid.alpha = 0.12;
      const step = 80;
      for (let x = 0; x <= WORLD_WIDTH; x += step) {
        grid.moveTo(x, 0);
        grid.lineTo(x, WORLD_HEIGHT);
      }
      for (let y = 0; y <= WORLD_HEIGHT; y += step) {
        grid.moveTo(0, y);
        grid.lineTo(WORLD_WIDTH, y);
      }
      grid.stroke({ width: 1, color: 0x5eead4 });
      world.addChild(grid);

      const border = new Graphics();
      border.eventMode = "none";
      border.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      border.stroke({ width: 2, color: 0x2dd4bf, alpha: 0.35 });
      world.addChild(border);

      const proximityGfx = new Graphics();
      proximityGfx.eventMode = "none";
      world.addChild(proximityGfx);
      proximityGfxRef.current = proximityGfx;

      const linkLineGfx = new Graphics();
      linkLineGfx.eventMode = "none";
      world.addChild(linkLineGfx);
      linkLineGfxRef.current = linkLineGfx;

      const playersRoot = new Container();
      playersRoot.sortableChildren = true;
      world.addChild(playersRoot);
      playersRootRef.current = playersRoot;

      app.ticker.add(tick);

      const ro = new ResizeObserver(() => syncLayout());
      ro.observe(host);
      app.renderer.on("resize", syncLayout);
      syncLayout();

      setReady(true);
    })();

    return () => {
      cancelled = true;
      setReady(false);
      const a = appRef.current;
      if (a) {
        a.ticker.remove(tick);
      }
      playerRootsRef.current.clear();
      proximityGfxRef.current = null;
      linkLineGfxRef.current = null;
      playersRootRef.current = null;
      worldRef.current = null;
      appRef.current?.destroy(true);
      appRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const playersRoot = playersRootRef.current;
    if (!playersRoot) return;

    const roots = playerRootsRef.current;
    const seen = new Set<string>();

    for (const [id, p] of players) {
      seen.add(id);
      let root = roots.get(id);
      if (!root) {
        root = new Container();
        root.eventMode = "none";
        root.zIndex = id === selfId ? 2 : 1;

        const body = new Graphics();
        body.eventMode = "none";

        const ring = new Graphics();
        ring.eventMode = "none";

        const label = new Text({ text: p.displayName, style: NAME_STYLE });
        label.anchor.set(0.5, 1);
        label.position.set(0, -PLAYER_RADIUS - 7);
        label.eventMode = "none";

        root.addChild(body);
        root.addChild(ring);
        root.addChild(label);
        playersRoot.addChild(root);
        roots.set(id, root);
      }

      const body = root.getChildAt(0) as Graphics;
      const ring = root.getChildAt(1) as Graphics;
      const label = root.getChildAt(2) as Text;

      label.text = p.displayName;
      root.zIndex = id === selfId ? 2 : 1;

      const isSelf = id === selfId;
      const isLinkedPeer = Boolean(linkedPeerId && id === linkedPeerId);

      body.clear();
      body.circle(0, 0, PLAYER_RADIUS);
      body.fill({
        color: isSelf ? 0x5eead4 : 0x64748b,
        alpha: isSelf ? 0.95 : 0.88,
      });
      body.stroke({
        width: isSelf ? 3 : 2,
        color: isSelf ? 0xccfbf1 : 0x94a3b8,
        alpha: 0.95,
      });

      ring.clear();
      if (isLinkedPeer) {
        ring.circle(0, 0, PLAYER_RADIUS + 5);
        ring.stroke({ width: 2.5, color: 0xfbbf24, alpha: 0.95 });
      }
    }

    for (const id of roots.keys()) {
      if (!seen.has(id)) {
        const root = roots.get(id);
        if (root) {
          playersRoot.removeChild(root);
          root.destroy({ children: true });
        }
        roots.delete(id);
      }
    }
  }, [players, selfId, linkedPeerId, ready]);

  return (
    <div
      ref={hostRef}
      className="h-full min-h-[320px] w-full overflow-hidden rounded-xl border border-white/10 bg-cosmos-mist/80"
    />
  );
}
