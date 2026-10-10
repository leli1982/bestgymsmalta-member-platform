import catCow from "./assets/cat-cow.ts";
import { movementAssetsA } from "./assets/movement-assets-a.ts";
import { movementAssetsB } from "./assets/movement-assets-b.ts";
import { movementAssetsC } from "./assets/movement-assets-c.ts";

export const movementVisualAssets: Record<string, string> = {
  ...movementAssetsA,
  ...movementAssetsB,
  ...movementAssetsC,
  "cat-cow": catCow,
};
