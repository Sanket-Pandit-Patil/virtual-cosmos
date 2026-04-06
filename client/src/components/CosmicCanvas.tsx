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

type ProximityPairIds = { a: string; b: string };

type Props = {
  players: Map<string, Player>;
  selfId: string | null;
  proximityPairs: ProximityPairIds[];
  onWorldClick?: (x: number, y: number) => void;
};

const LERP = 0.2;

/** Default avatar face (shared); outer ring color differentiates self vs others. */
const AVATAR_BLUE = 0x3b82f6;
const AVATAR_DARK_RIM = 0x0f172a;
const AVATAR_SILHOUETTE = 0xbfdbfe;
const SELF_OUTER_RING = 0x22d3ee;
const OTHER_OUTER_RING = 0x94a3b8;
/** Linked-peer highlight: you see green on yourself, orange on everyone else in a pair. */
const SELF_LINK_RING = 0x22c55e;
const PEER_LINK_RING = 0xf97316;

const NAME_LABEL_STYLE = {
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

/** Procedural default avatar: blue disk, silhouette, dark inner rim, colored outer ring. */
function drawDefaultAvatar(g: Graphics, isSelf: boolean): void {
  const R = PLAYER_RADIUS;
  const outer = isSelf ? SELF_OUTER_RING : OTHER_OUTER_RING;
  g.clear();

  g.circle(0, 0, R - 0.75);
  g.stroke({ width: 3, color: outer, alpha: 0.97 });

  g.circle(0, 0, R - 2.5);
  g.fill({ color: AVATAR_BLUE, alpha: 1 });
  g.stroke({ width: 1.2, color: AVATAR_DARK_RIM, alpha: 0.9 });

  g.ellipse(0, 5.5, 8.2, 5);
  g.fill({ color: AVATAR_SILHOUETTE, alpha: 0.52 });

  g.circle(0, -4.2, 3.3);
  g.fill({ color: AVATAR_SILHOUETTE, alpha: 0.72 });
}

/** root → avatarWrap(0) → avatarG(0); ring(1); nameLabel(2) */
function getAvatarGraphics(root: Container): Graphics {
  const avatarWrap = root.getChildAt(0) as Container;
  return avatarWrap.getChildAt(0) as Graphics;
}

export function CosmicCanvas({ players, selfId, proximityPairs, onWorldClick }: Props) {
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
  const proximityPairsRef = useRef(proximityPairs);
  selfIdRef.current = selfId;
  proximityPairsRef.current = proximityPairs;

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
      const playersRoot = playersRootRef.current;
      const proximityGfx = proximityGfxRef.current;
      const linkLineGfx = linkLineGfxRef.current;
      if (!playersRoot || !proximityGfx || !linkLineGfx) return;

      const targets = targetsRef.current;
      const smooth = smoothRef.current;
      const sid = selfIdRef.current;
      const pairs = proximityPairsRef.current;

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
          proximityGfx.stroke({ width: 1.5, color: SELF_OUTER_RING, alpha: 0.28 });
        }
      }

      for (const { a, b } of pairs) {
        const sa = smooth.get(a);
        const sb = smooth.get(b);
        if (!sa || !sb) continue;
        linkLineGfx.moveTo(sa.x, sa.y);
        linkLineGfx.lineTo(sb.x, sb.y);
        linkLineGfx.stroke({ width: 2, color: PEER_LINK_RING, alpha: 0.45 });
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
      world.on("pointerdown", (e: FederatedPointerEvent) => {
        const local = world.toLocal(e.global);
        clickRef.current?.(local.x, local.y);
      });
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
      let playerRoot = roots.get(id);
      if (!playerRoot) {
        playerRoot = new Container();
        playerRoot.eventMode = "none";
        playerRoot.zIndex = id === selfId ? 2 : 1;

        const avatarWrap = new Container();
        avatarWrap.eventMode = "none";

        const avatarG = new Graphics();
        avatarG.eventMode = "none";
        avatarWrap.addChild(avatarG);

        const ring = new Graphics();
        ring.eventMode = "none";

        const nameLabel = new Text({ text: p.displayName, style: NAME_LABEL_STYLE });
        nameLabel.anchor.set(0.5, 1);
        nameLabel.position.set(0, -PLAYER_RADIUS - 10);
        nameLabel.eventMode = "none";

        playerRoot.addChild(avatarWrap);
        playerRoot.addChild(ring);
        playerRoot.addChild(nameLabel);
        playersRoot.addChild(playerRoot);
        roots.set(id, playerRoot);
      }

      const pr = roots.get(id)!;
      const avatarG = getAvatarGraphics(pr);
      const ring = pr.getChildAt(1) as Graphics;
      const nameLabel = pr.getChildAt(2) as Text;

      nameLabel.text = p.displayName;
      pr.zIndex = id === selfId ? 2 : 1;

      const isSelf = id === selfId;
      const inLinkedPair = proximityPairs.some((p) => p.a === id || p.b === id);

      drawDefaultAvatar(avatarG, isSelf);

      ring.clear();
      if (inLinkedPair) {
        const linkRingColor = isSelf ? SELF_LINK_RING : PEER_LINK_RING;
        ring.circle(0, 0, PLAYER_RADIUS + 5);
        ring.stroke({ width: 3, color: linkRingColor, alpha: 1 });
      }
    }

    for (const id of roots.keys()) {
      if (!seen.has(id)) {
        const dead = roots.get(id);
        if (dead) {
          playersRoot.removeChild(dead);
          dead.destroy({ children: true });
        }
        roots.delete(id);
      }
    }
  }, [players, selfId, proximityPairs, ready]);

  return (
    <div
      ref={hostRef}
      className="h-full min-h-[320px] w-full overflow-hidden rounded-xl border border-white/10 bg-cosmos-mist/80"
    />
  );
}
