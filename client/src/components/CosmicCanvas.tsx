import { useEffect, useRef, useState } from "react";
import { Application, Container, FederatedPointerEvent, Graphics, Rectangle } from "pixi.js";
import {
  PLAYER_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "@virtual-cosmos/shared";
import type { Player } from "../types";

type Props = {
  players: Map<string, Player>;
  selfId: string | null;
  /** World coordinates (same space as server x/y). */
  onWorldClick?: (x: number, y: number) => void;
};

export function CosmicCanvas({ players, selfId, onWorldClick }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const spritesRef = useRef<Map<string, Graphics>>(new Map());
  const [ready, setReady] = useState(false);
  const clickRef = useRef(onWorldClick);
  clickRef.current = onWorldClick;

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

      const ro = new ResizeObserver(() => syncLayout());
      ro.observe(host);
      app.renderer.on("resize", syncLayout);
      syncLayout();

      setReady(true);
    })();

    return () => {
      cancelled = true;
      setReady(false);
      appRef.current?.destroy(true);
      appRef.current = null;
      worldRef.current = null;
      spritesRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const world = worldRef.current;
    if (!world) return;

    const sprites = spritesRef.current;
    const seen = new Set<string>();

    for (const [id, p] of players) {
      seen.add(id);
      let g = sprites.get(id);
      if (!g) {
        g = new Graphics();
        g.eventMode = "none";
        world.addChild(g);
        sprites.set(id, g);
      }
      g.clear();
      const isSelf = id === selfId;
      const fill = isSelf ? 0x5eead4 : 0x64748b;
      const stroke = isSelf ? 0xccfbf1 : 0x94a3b8;
      g.circle(p.x, p.y, PLAYER_RADIUS);
      g.fill({ color: fill, alpha: isSelf ? 0.95 : 0.85 });
      g.stroke({ width: isSelf ? 3 : 2, color: stroke, alpha: 0.9 });
    }

    for (const id of sprites.keys()) {
      if (!seen.has(id)) {
        const g = sprites.get(id);
        if (g) {
          world.removeChild(g);
          g.destroy();
        }
        sprites.delete(id);
      }
    }
  }, [players, selfId, ready]);

  return (
    <div
      ref={hostRef}
      className="h-full min-h-[320px] w-full overflow-hidden rounded-xl border border-white/10 bg-cosmos-mist/80"
    />
  );
}
