import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { resolveShader } from "@vgpu/wgsl/runtime";

test("resolves the official gradient shader without a bundler", async () => {
  const resolved = await resolveShader({
    entry: fileURLToPath(new URL("../src/example/shader.wgsl", import.meta.url)),
  });

  assert.equal(typeof resolved.wgsl, "string");
  assert.match(resolved.wgsl, /fn fs_main/);
  assert.match(resolved.wgsl, /@location\(0\) uv: vec2f/);
});
