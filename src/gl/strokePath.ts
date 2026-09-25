/**
 * A deterministic, cursive-handwriting-like stroke shared by the WebGL pen (PenGL)
 * and the lightweight SVG fallback (HandDrawn) — the same line on every device.
 *
 * Construction (in loose "pen units", normalised at the end):
 *   lead-in  → five prolate-cycloid loops (tall/short rhythm, like a written "lelle")
 *            → a hook down past the baseline → a long underline flourish sweeping back left.
 *
 * The result is resampled to equal arc-length steps, so index / (n - 1) ≈ distance travelled —
 * exactly what TubeGeometry (getPointAt) and SVG dash offsets both use.
 */

export interface StrokePoint {
  x: number
  y: number
}

export interface Stroke {
  /** equal arc-length samples; x ∈ [0, 1], y ∈ [0, aspect], y points UP */
  points: StrokePoint[]
  /** height / width of the stroke's bounding box */
  aspect: number
}

const TAU = Math.PI * 2
const LOOPS = 5
// tops of each loop (pen units) — a tall/short rhythm, like real handwriting
const HEIGHTS = [7.4, 4.5, 8.4, 5.1, 7.0]
// how far each loop swings back (> 1 makes a loop; bigger = rounder)
const LOOPINESS = [2.3, 1.95, 2.6, 2.05, 2.4]
const SLANT = 0.22 // forward italic lean
const T_START = -Math.PI // bottom of the stroke that rises into loop 0
const T_END = TAU * (LOOPS - 1) + Math.PI // bottom after the final loop

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** per-loop value that holds steady around each loop top and eases between them near the baseline */
const perLoop = (values: number[], t: number) => {
  const u = t / TAU
  const i = Math.floor(u)
  const w = smoothstep(0.3, 0.7, u - i)
  const at = (k: number) => values[Math.min(values.length - 1, Math.max(0, k))]
  return at(i) + (at(i + 1) - at(i)) * w
}

/** the looping body — a prolate cycloid with varying loop height/width, slant and a lazy baseline */
function loopAt(t: number): StrokePoint {
  const d = perLoop(LOOPINESS, t)
  const h = perLoop(HEIGHTS, t)
  const y = h * (1 + Math.cos(t)) * 0.5 + Math.sin(t * 0.37 + 0.4) * 0.18
  const x = t - d * Math.sin(t) + y * SLANT
  return { x, y }
}

function bezier(a: StrokePoint, b: StrokePoint, c: StrokePoint, d: StrokePoint, steps: number, out: StrokePoint[]) {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const m = 1 - t
    const k0 = m * m * m
    const k1 = 3 * m * m * t
    const k2 = 3 * m * t * t
    const k3 = t * t * t
    out.push({ x: k0 * a.x + k1 * b.x + k2 * c.x + k3 * d.x, y: k0 * a.y + k1 * b.y + k2 * c.y + k3 * d.y })
  }
}

const add = (p: StrokePoint, v: StrokePoint, s = 1) => ({ x: p.x + v.x * s, y: p.y + v.y * s })
const norm = (v: StrokePoint) => {
  const l = Math.hypot(v.x, v.y) || 1
  return { x: v.x / l, y: v.y / l }
}
const tangentAt = (t: number) => {
  const a = loopAt(t - 1e-3)
  const b = loopAt(t + 1e-3)
  return norm({ x: b.x - a.x, y: b.y - a.y })
}

function rawStroke(): StrokePoint[] {
  const pts: StrokePoint[] = []

  // lead-in: a soft upward entry that joins the baseline tangentially
  const j0 = loopAt(T_START)
  const t0 = tangentAt(T_START)
  const start = { x: j0.x - 2.1, y: j0.y - 0.7 }
  pts.push(start)
  bezier(start, { x: start.x + 0.8, y: start.y - 0.1 }, add(j0, t0, -1.1), j0, 40, pts)

  // the loops
  const step = 0.012
  for (let t = T_START + step; t < T_END; t += step) pts.push(loopAt(t))
  const e = loopAt(T_END)
  pts.push(e)

  // hook: carry on to the right, drop below the baseline and turn back left…
  const te = tangentAt(T_END)
  const r = { x: e.x + 2.3, y: e.y - 1.7 }
  bezier(e, add(e, te, 1.7), { x: r.x, y: r.y + 0.95 }, r, 60, pts)
  const b = { x: e.x - 1.2, y: e.y - 2.75 }
  bezier(r, { x: r.x, y: r.y - 0.8 }, { x: b.x + 1.7, y: b.y }, b, 60, pts)

  // …then the long underline, sweeping back under everything with a gentle belly
  const z = { x: j0.x - 3.6, y: j0.y - 2.2 }
  const dz = norm({ x: -1, y: 0.2 })
  bezier(b, { x: b.x - 9, y: b.y - 0.25 }, add(z, dz, -7.5), z, 220, pts)

  // a small lifting flick where the pen leaves the paper
  const f = { x: z.x - 1.3, y: z.y + 0.6 }
  bezier(z, add(z, dz, 0.7), add(f, norm({ x: -0.55, y: 0.85 }), -0.5), f, 30, pts)

  return pts
}

function resample(pts: StrokePoint[], n: number): StrokePoint[] {
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  const total = cum[cum.length - 1]
  const out: StrokePoint[] = []
  let k = 1
  for (let i = 0; i < n; i++) {
    const s = (i / (n - 1)) * total
    while (k < cum.length - 1 && cum[k] < s) k++
    const seg = cum[k] - cum[k - 1] || 1
    const f = Math.min(1, Math.max(0, (s - cum[k - 1]) / seg))
    out.push({ x: pts[k - 1].x + (pts[k].x - pts[k - 1].x) * f, y: pts[k - 1].y + (pts[k].y - pts[k - 1].y) * f })
  }
  return out
}

const cache = new Map<number, Stroke>()

/** The stroke, resampled to `samples` equal-length steps and normalised to x ∈ [0, 1]. */
export function getStroke(samples = 600): Stroke {
  const hit = cache.get(samples)
  if (hit) return hit
  const pts = resample(rawStroke(), samples)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  const w = maxX - minX
  const stroke: Stroke = {
    points: pts.map((p) => ({ x: (p.x - minX) / w, y: (p.y - minY) / w })),
    aspect: (maxY - minY) / w,
  }
  cache.set(samples, stroke)
  return stroke
}

/**
 * Smooth SVG path (Catmull-Rom → cubic Bézier) for a viewBox of `width × width·aspect`.
 * SVG's y axis points down, so the stroke is flipped here.
 */
export function strokeToSvgPath(stroke: Stroke, width = 1000): string {
  const h = stroke.aspect * width
  const P = stroke.points.map((p) => ({ x: p.x * width, y: h - p.y * width }))
  const f = (v: number) => Math.round(v * 100) / 100
  let d = `M${f(P[0].x)} ${f(P[0].y)}`
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)]
    const p1 = P[i]
    const p2 = P[i + 1]
    const p3 = P[Math.min(P.length - 1, i + 2)]
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += `C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2.x)} ${f(p2.y)}`
  }
  return d
}
