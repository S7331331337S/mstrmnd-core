import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { resolveShader } from "@vgpu/wgsl/runtime";
import { effect, init, target } from "vgpu/node";

const width = 160;
const height = 90;
const outPath = fileURLToPath(new URL("../frame.png", import.meta.url));

const resolved = await resolveShader({
  entry: fileURLToPath(new URL("../src/example/shader.wgsl", import.meta.url)),
});

const gpu = await init();
try {
  const colorTarget = target(gpu, { size: [width, height] });
  effect(gpu, resolved.wgsl).draw(colorTarget);
  const pixels = await colorTarget.read();
  if (pixels.length !== width * height * 4) {
    throw new Error(`Unexpected pixel buffer length: ${pixels.length}`);
  }

  const png = new PNG({ width, height });
  png.data.set(pixels);
  writeFileSync(outPath, PNG.sync.write(png));
  console.log(`wrote ${outPath} (${pixels.length} bytes)`);
} finally {
  gpu.dispose();
}
