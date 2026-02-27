import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSlotLabel } from "./slot";

test('normalize "P1"', () => {
  assert.equal(normalizeSlotLabel("P1"), "P1");
});

test('normalize "p2"', () => {
  assert.equal(normalizeSlotLabel("p2"), "P2");
});

test('normalize "  P10  "', () => {
  assert.equal(normalizeSlotLabel("  P10  "), "P10");
});

test('normalize "1"', () => {
  assert.equal(normalizeSlotLabel("1"), "P1");
});

test('normalize "10"', () => {
  assert.equal(normalizeSlotLabel("10"), "P10");
});

test('normalize " 3 "', () => {
  assert.equal(normalizeSlotLabel(" 3 "), "P3");
});

test('reject "P11"', () => {
  assert.equal(normalizeSlotLabel("P11"), null);
});
