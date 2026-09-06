import { useEffect, useRef, useState } from "react";
import { createRenderer } from "./example/renderer";

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pending = createRenderer(canvas).catch((cause: unknown) => {
      const message =
        cause instanceof Error ? cause.message : "WebGPU initialization failed";
      setError(message);
      return undefined;
    });

    return () => {
      void pending.then((renderer) => renderer?.dispose());
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />
      {error ? (
        <div className="fallback">
          <p>WebGPU adapter is not available in this browser.</p>
          <p className="fallback-detail">{error}</p>
          <p>
            The official gradient still renders headless:{" "}
            <code>pnpm --filter @mstrmnd/vgpu-app render</code>
          </p>
        </div>
      ) : null}
    </div>
  );
}
