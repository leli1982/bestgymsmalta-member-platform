import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MEMBER_HERO_POSITION,
  parseMemberHeroPosition,
  dragMemberHeroPosition,
} from "../lib/memberHeroPosition.ts";

test("published focal-point data must be finite and within bounds", () => {
  assert.deepEqual(DEFAULT_MEMBER_HERO_POSITION, { x: 38, y: 50 });
  assert.deepEqual(parseMemberHeroPosition("38.243", 52), { x: 38.24, y: 52 });
  for (const pair of [[-1, 40], [101, 0], [10, NaN], [10, Infinity], ["", 50], ["x", 50], [null, 40], [40, null]]) {
    assert.equal(parseMemberHeroPosition(pair[0], pair[1]), null, String(pair));
  }
});

test("dragging toward right reveals more image from the left", () => {
  assert.deepEqual(dragMemberHeroPosition({ x: 50, y: 50 }, 20, -10, 100, 100), { x: 30, y: 60 });
  assert.deepEqual(dragMemberHeroPosition({ x: 50, y: 50 }, -1000, 1000, 100, 100), { x: 100, y: 0 });
});

test("dragging never moves an axis without cover overflow", () => {
  assert.deepEqual(dragMemberHeroPosition({ x: 38, y: 50 }, 50, 25, 0, 100), { x: 38, y: 25 });
  assert.deepEqual(dragMemberHeroPosition({ x: 38, y: 50 }, 30, -30, 100, 0), { x: 8, y: 50 });
});
