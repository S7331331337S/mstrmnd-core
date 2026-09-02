import type { FieldHandle, FieldPointer } from "./field-types";

const VERT = `#version 300 es
precision highp float;
const vec2 POS[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
out vec2 vUv;
void main() {
  vec2 p = POS[gl_VertexID];
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

// Same platinum field as field.wgsl, ported for machines without WebGPU.
const FRAG = `#version 300 es
precision highp float;
uniform float time;
uniform vec2 pointer;
uniform vec2 resolution;
in vec2 vUv;
out vec4 fragColor;

const vec3 OBSIDIAN = vec3(0.039215686, 0.039215686, 0.043137255);
const vec3 PLATINUM = vec3(0.9098039, 0.8862745, 0.8156863);

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
float fbm(vec2 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 5; i++) {
    s += a * noise(p);
    p = p * 2.02 + vec2(17.2, 9.1);
    a *= 0.5;
  }
  return s;
}
float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}
vec3 rotY(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}
vec3 rotX(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
}
vec2 mapScene(vec3 p) {
  float floorD = p.y + 0.92;
  float plates = 1e5;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float y = -0.42 + fi * 0.21;
    float spin = time * (0.07 + fi * 0.018) + fi * 0.7;
    vec3 q = rotY(p - vec3(0.0, y, 0.0), spin);
    plates = min(plates, sdBox(q, vec3(1.35 - fi * 0.12, 0.018, 0.72)));
  }
  float ring = sdTorus(rotX(rotY(p - vec3(0.0, 0.22, 0.0), time * 0.11), 1.15), vec2(0.62, 0.018));
  float shaft = sdBox(p - vec3(0.0, 0.08, 0.0), vec3(0.035, 0.78, 0.035));
  float core = abs(length(p - vec3(0.0, 0.08, 0.0)) - 0.18) - 0.012;
  float scan = sdBox(rotY(p - vec3(0.0, 0.48 + 0.04 * sin(time * 0.9), 0.0), time * 0.35), vec3(1.05, 0.004, 1.05));
  float metal = min(min(min(plates, ring), min(shaft, core)), scan);
  return floorD < metal ? vec2(floorD, 1.0) : vec2(metal, 2.0);
}
vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.0016, 0.0);
  return normalize(vec3(
    mapScene(p + e.xyy).x - mapScene(p - e.xyy).x,
    mapScene(p + e.yxy).x - mapScene(p - e.yxy).x,
    mapScene(p + e.yyx).x - mapScene(p - e.yyx).x
  ));
}
float shadowAt(vec3 origin, vec3 lightDir) {
  float t = 0.03;
  float res = 1.0;
  for (int i = 0; i < 28; i++) {
    float h = mapScene(origin + lightDir * t).x;
    res = min(res, 14.0 * h / t);
    t += clamp(h, 0.02, 0.18);
    if (res < 0.01 || t > 8.0) break;
  }
  return clamp(res, 0.0, 1.0);
}
float gridFloor(vec3 p) {
  vec2 g = abs(fract(p.xz * 1.35) - 0.5);
  float line = 1.0 - smoothstep(0.0, 0.025, min(g.x, g.y));
  float major = 1.0 - smoothstep(0.0, 0.04, min(abs(fract(p.x * 0.27) - 0.5), abs(fract(p.z * 0.27) - 0.5)));
  return max(line * 0.35, major * 0.7);
}
vec3 camera(vec2 uv, vec3 ro, vec3 ta) {
  vec3 f = normalize(ta - ro);
  vec3 r = normalize(cross(f, vec3(0.0, 1.0, 0.0)));
  vec3 u = cross(r, f);
  return normalize(r * uv.x + u * uv.y + f * 1.55);
}

void main() {
  float aspect = resolution.x / max(resolution.y, 1.0);
  vec2 st = vec2((vUv.x - 0.5) * aspect, vUv.y - 0.5);
  float breath = 0.18 * sin(time * 0.17);
  float orbit = time * 0.08;
  vec3 ro = vec3(sin(orbit) * (3.4 + breath), 1.15, cos(orbit) * (3.4 + breath));
  vec3 ta = vec3(0.0, 0.05, 0.0);
  vec3 rd = camera(st, ro, ta);
  float t = 0.0;
  vec2 hit = vec2(0.0);
  vec3 p = ro;
  bool found = false;
  for (int i = 0; i < 72; i++) {
    p = ro + rd * t;
    hit = mapScene(p);
    if (hit.x < 0.0012) { found = true; break; }
    t += hit.x;
    if (t > 14.0) break;
  }
  vec2 lampUv = vec2(pointer.x * 2.0 - 1.0, 1.0 - pointer.y * 2.0);
  vec3 lamp = vec3(lampUv.x * 1.8, 1.45, lampUv.y * 1.6);
  float grain = hash21(vUv * resolution + time) * 0.035;
  vec3 col = OBSIDIAN;
  if (found) {
    vec3 n = normalAt(p);
    vec3 l = normalize(lamp - p);
    vec3 v = normalize(ro - p);
    vec3 h = normalize(l + v);
    float ndotl = max(dot(n, l), 0.0);
    float spec = pow(max(dot(n, h), 0.0), 48.0);
    float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    float sh = shadowAt(p + n * 0.012, l);
    vec3 albedo = PLATINUM * 0.22;
    if (hit.y < 1.5) {
      albedo = mix(OBSIDIAN * 1.4, PLATINUM * 0.55, gridFloor(p));
    } else {
      float mill = 0.5 + 0.5 * sin((p.x + p.z) * 42.0);
      albedo = PLATINUM * (0.18 + mill * 0.07);
    }
    vec3 lit = albedo * (0.08 + ndotl * 0.95 * sh) + PLATINUM * spec * 0.85 * sh + PLATINUM * rim * 0.18;
    col = mix(lit, OBSIDIAN, 1.0 - exp(-t * 0.11));
  } else {
    float haze = fbm(st * 2.4 + vec2(time * 0.04, 0.0));
    col = mix(OBSIDIAN, PLATINUM * 0.07, haze * 0.55);
    col += PLATINUM * exp(-length(st - lampUv * 0.22) * 3.2) * 0.08;
    float beam = exp(-abs(st.x) * 9.0) * (0.55 + 0.45 * sin(time * 0.7));
    col += PLATINUM * beam * 0.045;
  }
  col *= 0.72 + 0.28 * smoothstep(1.25, 0.35, length(st));
  col += grain;
  col = pow(max(col, 0.0), vec3(0.92));
  fragColor = vec4(col, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("WebGL shader alloc failed");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "compile failed";
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

export function createWebGlField(
  canvas: HTMLCanvasElement,
  getPointer: () => FieldPointer,
): FieldHandle {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    powerPreference: "high-performance",
  });
  if (!gl) throw new Error("WebGL2 unavailable");

  const program = gl.createProgram();
  if (!program) throw new Error("WebGL program alloc failed");
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "link failed");
  }
  gl.useProgram(program);
  const uTime = gl.getUniformLocation(program, "time");
  const uPointer = gl.getUniformLocation(program, "pointer");
  const uResolution = gl.getUniformLocation(program, "resolution");
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  let frame = 0;
  let disposed = false;
  const start = performance.now();

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
  };

  const draw = (now: number) => {
    if (disposed) return;
    resize();
    const pointer = getPointer();
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.uniform2f(uPointer, pointer.x, pointer.y);
    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);

  return {
    backend: "webgl2" as const,
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteVertexArray(vao);
    },
  };
}
