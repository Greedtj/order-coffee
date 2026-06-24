import assert from "node:assert/strict";
import test from "node:test";
import { validOrder, validProject } from "../src/validation.js";

test("accepts the MVP inputs and rejects oversized or unknown values", () => {
  assert.equal(validOrder({ clientToken: "device", name: "แก้ว", details: "ลาเต้เย็น" }), true);
  assert.equal(validOrder({ clientToken: "device", name: "แก้ว", details: "x".repeat(301) }), false);
  assert.equal(validProject({ name: "ประชุมทีม", date: "2026-06-24", shop: "Café Amazon" }), true);
  assert.equal(validProject({ name: "ประชุมทีม", date: "2026-06-24", shop: "ร้านอื่น" }), false);
});
