/**
 * One lookup for every picture that can stand on the island.
 *
 * The four sprite files each bring their own letter-to-colour table, so a sprite
 * is only usable together with its palette. This hands out both, plus the pixel
 * the picture sits on: the water pieces carry their own anchor, the land objects
 * get theirs from `islandLand.ts`.
 */

import { LAND_ANCHORS } from "../../lib/islandLand";
import { BEACH_COLORS, BEACH_SHADOW, BEACH_SPRITES } from "../grow/beachSprites";
import { BUILDING_COLORS, BUILDING_SHADOW, BUILDING_SPRITES } from "../grow/buildingSprites";
import { PLANT_COLORS, PLANT_SHADOW, PLANT_SPRITES } from "../grow/plantSprites";
import { SPECIAL_COLORS, SPECIAL_SHADOW, SPECIAL_SPRITES } from "../grow/specialSprites";
import { PIECE_COLORS, PIECE_SHADOW, PIECE_SPRITES } from "../grow/waterPieceSprites";

export interface IslandSprite {
  w: number;
  h: number;
  /** The pixel of the picture that sits on the spot. */
  ax: number;
  ay: number;
  rows: string[];
  colors: Record<string, string>;
  shadow: string;
}

const LAND_SETS = [
  { sprites: PLANT_SPRITES, colors: PLANT_COLORS, shadow: PLANT_SHADOW },
  { sprites: BUILDING_SPRITES, colors: BUILDING_COLORS, shadow: BUILDING_SHADOW },
  { sprites: BEACH_SPRITES, colors: BEACH_COLORS, shadow: BEACH_SHADOW },
  { sprites: SPECIAL_SPRITES, colors: SPECIAL_COLORS, shadow: SPECIAL_SHADOW },
];

export function islandSprite(name: string): IslandSprite | null {
  const piece = PIECE_SPRITES[name];
  if (piece) {
    return { ...piece, colors: PIECE_COLORS, shadow: PIECE_SHADOW };
  }
  const anchor = LAND_ANCHORS[name];
  for (const set of LAND_SETS) {
    const data = set.sprites[name];
    if (!data) continue;
    return {
      w: data.w,
      h: data.h,
      // Without a known anchor the picture stands on its bottom middle.
      ax: anchor ? anchor[0] : Math.round(data.w / 2),
      ay: anchor ? anchor[1] : data.h,
      rows: data.rows,
      colors: set.colors,
      shadow: set.shadow,
    };
  }
  return null;
}

/**
 * How far a point is from a picture standing at (x, y), in artwork pixels.
 *
 * Zero when the point lands on the picture itself — a drawn pixel, shadow
 * included — otherwise the distance to the picture's box, and `null` when there
 * is no such picture.
 *
 * This is what makes taking hold of something feel right. A house is drawn tall
 * and upwards from the cell it stands on, so asking which *ground cell* was
 * touched means you have to grab a house by its doorstep and a tree by its
 * roots. You grab what you see.
 */
export function spriteReach(
  name: string,
  x: number,
  y: number,
  pointX: number,
  pointY: number,
): number | null {
  const sprite = islandSprite(name);
  if (!sprite) return null;
  const left = Math.round(x) - sprite.ax;
  const top = Math.round(y) - sprite.ay;
  const column = Math.floor(pointX - left);
  const row = Math.floor(pointY - top);
  if (row >= 0 && row < sprite.rows.length && column >= 0) {
    const line = sprite.rows[row];
    if (column < line.length && line[column] !== ".") return 0;
  }
  const dx = Math.max(left - pointX, 0, pointX - (left + sprite.w));
  const dy = Math.max(top - pointY, 0, pointY - (top + sprite.h));
  return Math.hypot(dx, dy);
}
