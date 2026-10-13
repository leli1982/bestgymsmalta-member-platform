import { movementCatalog } from "./catalog.ts";
import type { MovementDefinition } from "./types.ts";

export type MovementLookup =
  | string
  | {
      movementId?: string | null;
      name?: string | null;
    };

export function normalizeMovementName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

const movementById = new Map<string, MovementDefinition>();
const movementByName = new Map<string, MovementDefinition>();

for (const movement of movementCatalog) {
  movementById.set(movement.id, movement);
  movementByName.set(normalizeMovementName(movement.name), movement);

  for (const alias of movement.aliases) {
    movementByName.set(normalizeMovementName(alias), movement);
  }
}

export function resolveMovement(input: MovementLookup): MovementDefinition | null {
  if (typeof input === "string") {
    const normalized = normalizeMovementName(input);
    return normalized ? movementByName.get(normalized) ?? null : null;
  }

  if (input.movementId) {
    const movement = movementById.get(input.movementId);
    if (movement) return movement;
  }

  const normalized = normalizeMovementName(input.name ?? "");
  return normalized ? movementByName.get(normalized) ?? null : null;
}
