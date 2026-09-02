export type FieldPointer = {
  x: number;
  y: number;
};

export type FieldBackend = "webgpu" | "webgl2";

export type FieldHandle = {
  backend: FieldBackend;
  dispose(): void;
};
