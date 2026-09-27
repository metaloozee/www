// Barrel curvature, shared by the fragment shader and pointer hit-testing.
// Dividing by (1 + K) keeps the edge midpoints fixed and pulls the centre in.
export const CURVATURE = 0.03;

export function barrel(u: number, v: number): [number, number] {
  const x = u * 2 - 1;
  const y = v * 2 - 1;
  const f = (1 + CURVATURE * (x * x + y * y)) / (1 + CURVATURE);
  return [(x * f + 1) / 2, (y * f + 1) / 2];
}

const VERTEX = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D uText;
uniform vec2 uTexSize;   // text grid in font pixels
uniform vec2 uScreen;    // glass in device pixels
uniform vec4 uContent;   // text grid rect inside the glass, device pixels
uniform float uDpr;
uniform float uRadius;  // glass corner radius, device pixels
uniform float uTime;
uniform float uMotion;   // 0 under prefers-reduced-motion
uniform vec3 uGlass;
uniform vec3 uTube;     // tube interior visible past the curved screen

in vec2 vUv;
out vec4 outColor;

const float K = ${CURVATURE.toFixed(4)};

vec2 barrel(vec2 uv) {
  vec2 c = uv * 2.0 - 1.0;
  c *= (1.0 + K * dot(c, c)) / (1.0 + K);
  return c * 0.5 + 0.5;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Sharp-bilinear: crisp font pixels that still anti-alias along the curve.
vec3 textAt(vec2 px) {
  vec2 local = (px - uContent.xy) / uContent.zw;
  if (any(lessThan(local, vec2(0.0))) || any(greaterThan(local, vec2(1.0)))) {
    return uGlass;
  }
  vec2 texel = local * uTexSize;
  vec2 scale = uContent.zw / uTexSize;
  vec2 s = fract(texel) - 0.5;
  vec2 region = 0.5 - 0.5 / scale;
  vec2 f = (s - clamp(s, -region, region)) * scale + 0.5;
  return textureLod(uText, (floor(texel) + f) / uTexSize, 0.0).rgb;
}

void main() {
  vec2 uv = barrel(vUv);
  vec2 px = uv * uScreen;

  vec2 half_ = uScreen * 0.5;
  float radius = uRadius;
  vec2 q = abs(px - half_) - half_ + radius;
  float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
  float mask = 1.0 - smoothstep(-1.0, 1.0, dist);

  vec2 fromCentre = uv - 0.5;
  float edge = clamp(length(fromCentre) * 1.4142, 0.0, 1.0);
  // Fringe is measured in font pixels so it covers the same share of a
  // glyph at 1x and 2x cells: 0.25 at the centre to 1.25 at the edge.
  float fontPx = uContent.z / uTexSize.x;
  vec2 fringe = normalize(fromCentre + 1e-5) * mix(0.25, 1.25, edge) * fontPx;

  vec3 col = vec3(
    textAt(px + fringe).r,
    textAt(px).g,
    textAt(px - fringe).b
  );

  // Bloom fades out past the grid edge; clamped sampling would otherwise
  // smear the outermost rows across the empty glass as streaks.
  vec2 rawLocal = (px - uContent.xy) / uContent.zw;
  vec2 local = clamp(rawLocal, 0.0, 1.0);
  vec2 overshoot = abs(rawLocal - local) * uContent.zw / (16.0 * uDpr);
  float inside = exp(-dot(overshoot, overshoot));
  vec3 bloom = textureLod(uText, local, 2.0).rgb * 0.6
             + textureLod(uText, local, 3.5).rgb * 0.4;
  col += (bloom - uGlass) * 0.35 * inside;

  float row = fract((px.y - uContent.y) / uContent.w * uTexSize.y) - 0.5;
  col *= 1.0 - 0.12 * (row * row * 4.0);

  col *= 1.0 - 0.35 * edge * edge;

  float t = uTime * uMotion;
  float bandY = fract(t / 9.0) * 1.2 - 0.1;
  col += 0.04 * uMotion * exp(-pow((uv.y - bandY) * 10.0, 2.0));
  col *= 1.0 + 0.005 * uMotion * sin(t * 57.0);
  col += (hash(px + fract(t) * 173.0) - 0.5) * 0.03;

  outColor = vec4(mix(uTube, col, mask), 1.0);
}`;

export type Rgb = [number, number, number];

export interface Frame {
  content: [number, number, number, number];
  dpr: number;
  motion: boolean;
  radius: number;
  time: number;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("createShader failed");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "shader compile failed");
  }
  return shader;
}

export class CrtRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly uniforms: Record<string, WebGLUniformLocation | null>;
  private texSize: [number, number] = [1, 1];

  constructor(gl: WebGL2RenderingContext, glass: Rgb, tube: Rgb) {
    this.gl = gl;
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "program link failed");
    }
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const names = [
      "uText",
      "uTexSize",
      "uScreen",
      "uContent",
      "uDpr",
      "uRadius",
      "uTime",
      "uMotion",
      "uGlass",
      "uTube",
    ];
    this.uniforms = Object.fromEntries(
      names.map((name) => [name, gl.getUniformLocation(program, name)])
    );
    gl.uniform1i(this.uniforms.uText, 0);
    gl.uniform3fv(this.uniforms.uGlass, glass);
    gl.uniform3fv(this.uniforms.uTube, tube);
  }

  upload(source: HTMLCanvasElement) {
    const TEX = this.gl.TEXTURE_2D;
    this.gl.texImage2D(
      TEX,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      source
    );
    this.gl.generateMipmap(TEX);
    this.texSize = [source.width, source.height];
  }

  render(frame: Frame) {
    const { width, height } = this.gl.canvas;
    const u = this.uniforms;
    this.gl.viewport(0, 0, width, height);
    this.gl.uniform2f(u.uTexSize, ...this.texSize);
    this.gl.uniform2f(u.uScreen, width, height);
    this.gl.uniform4f(u.uContent, ...frame.content);
    this.gl.uniform1f(u.uDpr, frame.dpr);
    this.gl.uniform1f(u.uRadius, frame.radius);
    this.gl.uniform1f(u.uTime, frame.time);
    this.gl.uniform1f(u.uMotion, frame.motion ? 1 : 0);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
  }
}
