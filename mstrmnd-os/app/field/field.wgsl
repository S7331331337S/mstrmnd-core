// MSTRMND Field — platinum-only industrial volume.
// Accent is #e8e2d0 over #0a0a0b. No second hue.

@group(0) @binding(0) var<uniform> time: f32;
@group(0) @binding(1) var<uniform> pointer: vec2f;
@group(0) @binding(2) var<uniform> resolution: vec2f;

const OBSIDIAN = vec3f(0.039215686, 0.039215686, 0.043137255);
const PLATINUM = vec3f(0.9098039, 0.8862745, 0.8156863);

fn hash21(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}

fn noise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2f(1.0, 0.0)), u.x),
    mix(hash21(i + vec2f(0.0, 1.0)), hash21(i + vec2f(1.0, 1.0)), u.x),
    u.y,
  );
}

fn fbm(p0: vec2f) -> f32 {
  var p = p0;
  var a = 0.5;
  var s = 0.0;
  for (var i = 0; i < 5; i++) {
    s += a * noise(p);
    p = p * 2.02 + vec2f(17.2, 9.1);
    a *= 0.5;
  }
  return s;
}

fn sdBox(p: vec3f, b: vec3f) -> f32 {
  let q = abs(p) - b;
  return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

fn sdTorus(p: vec3f, t: vec2f) -> f32 {
  let q = vec2f(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

fn rotY(p: vec3f, a: f32) -> vec3f {
  let c = cos(a);
  let s = sin(a);
  return vec3f(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

fn rotX(p: vec3f, a: f32) -> vec3f {
  let c = cos(a);
  let s = sin(a);
  return vec3f(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
}

fn mapScene(p0: vec3f) -> vec2f {
  var p = p0;
  let floorD = p.y + 0.92;
  var plates = 1e5;
  for (var i = 0; i < 5; i++) {
    let fi = f32(i);
    let y = -0.42 + fi * 0.21;
    let spin = time * (0.07 + fi * 0.018) + fi * 0.7;
    let q = rotY(p - vec3f(0.0, y, 0.0), spin);
    let slab = sdBox(q, vec3f(1.35 - fi * 0.12, 0.018, 0.72));
    plates = min(plates, slab);
  }
  let ring = sdTorus(rotX(rotY(p - vec3f(0.0, 0.22, 0.0), time * 0.11), 1.15), vec2f(0.62, 0.018));
  let shaft = sdBox(p - vec3f(0.0, 0.08, 0.0), vec3f(0.035, 0.78, 0.035));
  let core = abs(length(p - vec3f(0.0, 0.08, 0.0)) - 0.18) - 0.012;
  let scan = sdBox(rotY(p - vec3f(0.0, 0.48 + 0.04 * sin(time * 0.9), 0.0), time * 0.35), vec3f(1.05, 0.004, 1.05));
  let metal = min(min(min(plates, ring), min(shaft, core)), scan);
  if (floorD < metal) {
    return vec2f(floorD, 1.0);
  }
  return vec2f(metal, 2.0);
}

fn normalAt(p: vec3f) -> vec3f {
  let e = vec2f(0.0016, 0.0);
  return normalize(vec3f(
    mapScene(p + e.xyy).x - mapScene(p - e.xyy).x,
    mapScene(p + e.yxy).x - mapScene(p - e.yxy).x,
    mapScene(p + e.yyx).x - mapScene(p - e.yyx).x,
  ));
}

fn shadowAt(origin: vec3f, lightDir: vec3f) -> f32 {
  var t = 0.03;
  var res = 1.0;
  for (var i = 0; i < 28; i++) {
    let h = mapScene(origin + lightDir * t).x;
    res = min(res, 14.0 * h / t);
    t += clamp(h, 0.02, 0.18);
    if (res < 0.01 || t > 8.0) {
      break;
    }
  }
  return clamp(res, 0.0, 1.0);
}

fn gridFloor(p: vec3f) -> f32 {
  let g = abs(fract(p.xz * 1.35) - 0.5);
  let line = 1.0 - smoothstep(0.0, 0.025, min(g.x, g.y));
  let major = 1.0 - smoothstep(0.0, 0.04, min(
    abs(fract(p.x * 0.27) - 0.5),
    abs(fract(p.z * 0.27) - 0.5),
  ));
  return max(line * 0.35, major * 0.7);
}

fn camera(uv: vec2f, ro: vec3f, ta: vec3f) -> vec3f {
  let f = normalize(ta - ro);
  let r = normalize(cross(f, vec3f(0.0, 1.0, 0.0)));
  let u = cross(r, f);
  return normalize(r * uv.x + u * uv.y + f * 1.55);
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = resolution.x / max(resolution.y, 1.0);
  var st = vec2f((uv.x - 0.5) * aspect, 0.5 - uv.y);
  let breath = 0.18 * sin(time * 0.17);
  let orbit = time * 0.08;
  let ro = vec3f(sin(orbit) * (3.4 + breath), 1.15, cos(orbit) * (3.4 + breath));
  let ta = vec3f(0.0, 0.05, 0.0);
  let rd = camera(st, ro, ta);

  var t = 0.0;
  var hit = vec2f(0.0);
  var p = ro;
  var found = false;
  for (var i = 0; i < 72; i++) {
    p = ro + rd * t;
    hit = mapScene(p);
    if (hit.x < 0.0012) {
      found = true;
      break;
    }
    t += hit.x;
    if (t > 14.0) {
      break;
    }
  }

  let lampUv = vec2f(pointer.x * 2.0 - 1.0, 1.0 - pointer.y * 2.0);
  let lamp = vec3f(lampUv.x * 1.8, 1.45, lampUv.y * 1.6);
  let grain = hash21(uv * resolution + time) * 0.035;

  var col = OBSIDIAN;
  if (found) {
    let n = normalAt(p);
    let l = normalize(lamp - p);
    let v = normalize(ro - p);
    let h = normalize(l + v);
    let ndotl = max(dot(n, l), 0.0);
    let spec = pow(max(dot(n, h), 0.0), 48.0);
    let rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    let sh = shadowAt(p + n * 0.012, l);
    var albedo = PLATINUM * 0.22;
    if (hit.y < 1.5) {
      let g = gridFloor(p);
      albedo = mix(OBSIDIAN * 1.4, PLATINUM * 0.55, g);
    } else {
      let mill = 0.5 + 0.5 * sin((p.x + p.z) * 42.0);
      albedo = PLATINUM * (0.18 + mill * 0.07);
    }
    let lit = albedo * (0.08 + ndotl * 0.95 * sh)
      + PLATINUM * spec * 0.85 * sh
      + PLATINUM * rim * 0.18;
    let fog = 1.0 - exp(-t * 0.11);
    col = mix(lit, OBSIDIAN, fog);
  } else {
    let haze = fbm(st * 2.4 + vec2f(time * 0.04, 0.0));
    col = mix(OBSIDIAN, PLATINUM * 0.07, haze * 0.55);
    let glow = exp(-length(st - lampUv * 0.22) * 3.2);
    let beam = exp(-abs(st.x) * 9.0) * (0.55 + 0.45 * sin(time * 0.7));
    col += PLATINUM * glow * 0.08;
    col += PLATINUM * beam * 0.045;
  }

  let vignette = smoothstep(1.25, 0.35, length(st));
  col *= 0.72 + 0.28 * vignette;
  col += grain;
  col = pow(max(col, vec3f(0.0)), vec3f(0.92));
  return vec4f(col, 1.0);
}
