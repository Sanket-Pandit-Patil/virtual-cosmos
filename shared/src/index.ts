/** World bounds (logical units; same coordinate space client + server). */
export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 900;

/** Player avatar radius for clamping center inside the world. */
export const PLAYER_RADIUS = 18;

/** Distance at which mutual-nearest users may chat. */
export const PROXIMITY_RADIUS = 140;

/** Max travel speed in world units per second (server enforces per-tick delta). */
export const MAX_SPEED = 420;

/** How often the client should send absolute position (ms). */
export const POSITION_TICK_MS = 50;

/** Derived cap on movement magnitude per position update. */
export const MAX_DELTA_PER_TICK =
  MAX_SPEED * (POSITION_TICK_MS / 1000);

export const DISPLAY_NAME_MAX_LENGTH = 24;

export const CHAT_MESSAGE_MAX_LENGTH = 500;

export function clampToWorld(x: number, y: number): { x: number; y: number } {
  const minX = PLAYER_RADIUS;
  const maxX = WORLD_WIDTH - PLAYER_RADIUS;
  const minY = PLAYER_RADIUS;
  const maxY = WORLD_HEIGHT - PLAYER_RADIUS;
  return {
    x: Math.min(maxX, Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  };
}
