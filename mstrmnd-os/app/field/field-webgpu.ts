import { clock, effect, frameLoop, init, surface } from "vgpu";
import type { FieldHandle, FieldPointer } from "./field-types";
import fragment from "./field.wgsl";

export async function createWebGpuField(
  canvas: HTMLCanvasElement,
  getPointer: () => FieldPointer,
): Promise<FieldHandle> {
  const gpu = await init({ label: "mstrmnd-field" });
  try {
    const output = surface(gpu, canvas, { dpr: [1, 2], alphaMode: "opaque" });
    const shader = effect(gpu, fragment, { label: "mstrmnd-field" });
    const tick = clock(gpu);
    const loop = frameLoop(gpu, (currentFrame) => {
      const rect = canvas.getBoundingClientRect();
      const pointer = getPointer();
      shader.set({
        time: tick.time,
        pointer: [pointer.x, pointer.y],
        resolution: [Math.max(1, rect.width), Math.max(1, rect.height)],
      });
      currentFrame.pass(output, shader);
    });
    return {
      backend: "webgpu" as const,
      dispose() {
        loop.stop();
        gpu.dispose();
      },
    };
  } catch (error) {
    gpu.dispose();
    throw error;
  }
}
