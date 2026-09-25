import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { getStroke } from './strokePath'

export interface PenGLOptions {
  /** element the transparent canvas fills (the pinned section) */
  container: HTMLElement
  /** optional element whose box the stroke is fitted into (defaults to the container) */
  stage?: HTMLElement | null
}

const TUBULAR = 1400
const RADIAL = 8
const STROKE_RADIUS = 0.0021 // in stroke units (the stroke is 1 unit wide)
const GLOW_WIDTH = 5.5
const PEN_LENGTH = 2.6
const FOV = 28
const CAM_Z = 12
const DPR_CAP = 1.75
const EMBERS = 90
const UP = new THREE.Vector3(0, 1, 0)
// resting pose — the pen leans ~35° off the page, up and to the right, toward the viewer
const BASE_AXIS = new THREE.Vector3(0.434, 0.695, 0.574).normalize()

/** palette values are authored in sRGB and written straight to the (sRGB) canvas by the custom shaders */
const srgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const damp = (dt: number, lambda: number) => 1 - Math.exp(-lambda * dt)

const strokeVert = /* glsl */ `
  attribute float aWidth;
  uniform float uRadius;
  uniform float uWidth;
  uniform float uHead;
  varying float vU;
  varying vec3 vN;
  varying vec3 vV;

  void main() {
    vU = uv.x;
    float behind = uHead - uv.x;
    // wet ink swells just behind the nib; the live end tapers into the tip
    float w = aWidth * (1.0 + 0.3 * exp(-max(behind, 0.0) * 90.0));
    w *= mix(0.35, 1.0, smoothstep(0.0, 0.004, behind));
    vec3 center = position - normal * uRadius;
    vec3 pos = center + normal * uRadius * w * uWidth;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`

const strokeFrag = /* glsl */ `
  precision highp float;
  uniform vec3 uA;
  uniform vec3 uB;
  uniform vec3 uHot;
  uniform float uHead;
  uniform float uEnergy;
  varying float vU;
  varying vec3 vN;
  varying vec3 vV;

  void main() {
    float facing = abs(dot(normalize(vN), normalize(vV)));
    float behind = max(uHead - vU, 0.0);
    float hot = exp(-behind * 34.0) * (0.55 + 0.45 * uEnergy);
    vec3 col = mix(uA, uB, smoothstep(0.02, 0.98, vU));
  #ifdef GLOW
    float a = pow(facing, 3.0) * (0.14 + hot * 0.5);
    gl_FragColor = vec4(mix(col, uHot, hot * 0.6) * a, a); // premultiplied
  #else
    col *= 0.74 + 0.4 * facing;
    col = mix(col, uHot, hot * 0.85);
    col += uHot * pow(facing, 8.0) * 0.16;
    gl_FragColor = vec4(col, 1.0);
  #endif
  }
`

const spriteVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const spriteFrag = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float g = exp(-d * d * 5.0) * 0.8 + exp(-d * d * 40.0) * 0.6;
    float a = g * uIntensity * (1.0 - smoothstep(0.85, 1.0, d));
    gl_FragColor = vec4(uColor * a, a);
  }
`

const emberVert = /* glsl */ `
  attribute float aLife;
  attribute float aSeed;
  uniform float uSize;
  uniform float uPx;
  varying float vLife;
  void main() {
    vLife = aLife;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * uPx * (0.4 + aSeed * 0.8) * sqrt(aLife) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const emberFrag = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  varying float vLife;
  void main() {
    if (vLife <= 0.0) discard;
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.0, 1.0, d)) * vLife * 0.9;
    gl_FragColor = vec4(uColor * a, a);
  }
`

/**
 * The "No AI" moment: a procedural stylus that draws a glowing, hand-written stroke as you scroll.
 * Transparent canvas over its section; rendering pauses offscreen / when the tab is hidden.
 */
export class PenGL {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60)
  private clock = new THREE.Clock()
  private envRT: THREE.WebGLRenderTarget
  private curve: THREE.CatmullRomCurve3
  private aspect: number
  private strokeGroup = new THREE.Group()
  private tube: THREE.TubeGeometry
  private coreMat: THREE.ShaderMaterial
  private glowMat: THREE.ShaderMaterial
  private pen = new THREE.Group()
  private tipGlow: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  private tipLight = new THREE.PointLight('#ffc987', 0, 3, 2)
  private embers: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>
  private emberVel = new Float32Array(EMBERS * 3)
  private emberCursor = 0
  private emberBudget = 0

  private target = 0
  private head = 0
  private energy = 0
  private lift = 0.55
  private scale = 1
  private penScale = 1
  private axis = BASE_AXIS.clone()
  private mouse = { x: 0, y: 0, tx: 0, ty: 0 }
  private tmp = { p: new THREE.Vector3(), t: new THREE.Vector3(), a: new THREE.Vector3(), w: new THREE.Vector3() }

  private visible = true
  private running = false
  private io: IntersectionObserver
  private ro: ResizeObserver
  private disposers: (() => void)[] = []

  constructor(private opts: PenGLOptions) {
    const { container } = opts

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, DPR_CAP))
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    const canvas = this.renderer.domElement
    canvas.setAttribute('aria-hidden', 'true')
    canvas.style.pointerEvents = 'none'
    container.appendChild(canvas)
    this.camera.position.set(0, 0, CAM_Z)
    this.camera.lookAt(0, 0, 0)

    // image-based lighting for the lacquer & gold, plus a warm key and a rose rim
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const room = new RoomEnvironment()
    this.envRT = pmrem.fromScene(room, 0.04)
    room.dispose()
    pmrem.dispose()
    this.scene.environment = this.envRT.texture
    this.scene.environmentIntensity = 0.6
    this.scene.environmentRotation.set(0.2, 0.9, 0)

    const key = new THREE.DirectionalLight('#ffd6a0', 2.6)
    key.position.set(-4, 5, 7)
    const rim = new THREE.DirectionalLight('#e79aa6', 1.8)
    rim.position.set(5, 1.5, -4)
    this.scene.add(key, rim, this.tipLight)

    // ── the stroke ───────────────────────────────────────────────
    const stroke = getStroke(600)
    this.aspect = stroke.aspect
    this.curve = new THREE.CatmullRomCurve3(
      stroke.points.map((p) => new THREE.Vector3(p.x, p.y, 0)),
      false,
      'centripetal',
    )
    this.curve.arcLengthDivisions = 3000
    this.tube = new THREE.TubeGeometry(this.curve, TUBULAR, STROKE_RADIUS, RADIAL, false)
    this.tube.setAttribute('aWidth', new THREE.BufferAttribute(this.pressure(), 1))
    this.tube.setDrawRange(0, 0)

    const uniforms = () => ({
      uRadius: { value: STROKE_RADIUS },
      uWidth: { value: 1 },
      uHead: { value: 0 },
      uEnergy: { value: 0 },
      uA: { value: srgb('#e8b86a') },
      uB: { value: srgb('#e79aa6') },
      uHot: { value: srgb('#fff1d6') },
    })
    this.coreMat = new THREE.ShaderMaterial({ vertexShader: strokeVert, fragmentShader: strokeFrag, uniforms: uniforms() })
    this.glowMat = new THREE.ShaderMaterial({
      vertexShader: strokeVert,
      fragmentShader: strokeFrag,
      uniforms: uniforms(),
      defines: { GLOW: 1 },
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
    })
    this.glowMat.uniforms.uWidth.value = GLOW_WIDTH

    const core = new THREE.Mesh(this.tube, this.coreMat)
    const glow = new THREE.Mesh(this.tube, this.glowMat)
    core.frustumCulled = glow.frustumCulled = false
    glow.renderOrder = 1

    // the "sketch": a faint graphite guide of the whole line, inked over as the pen passes
    const guide = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(stroke.points.map((p) => new THREE.Vector3(p.x, p.y, -0.002))),
      new THREE.LineBasicMaterial({ color: '#f3ebe0', transparent: true, opacity: 0.075, depthWrite: false }),
    )
    this.strokeGroup.add(guide, core, glow)
    this.scene.add(this.strokeGroup)

    // ── the pen ───────────────────────────────────────────────
    this.buildPen()
    this.scene.add(this.pen)

    this.tipGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        vertexShader: spriteVert,
        fragmentShader: spriteFrag,
        uniforms: { uColor: { value: srgb('#ffd9a0') }, uIntensity: { value: 0 } },
        transparent: true,
        premultipliedAlpha: true,
        depthWrite: false,
      }),
    )
    this.tipGlow.renderOrder = 2
    this.scene.add(this.tipGlow)

    // embers shed by the nib as it moves
    const eg = new THREE.BufferGeometry()
    eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(EMBERS * 3), 3).setUsage(THREE.DynamicDrawUsage))
    eg.setAttribute('aLife', new THREE.BufferAttribute(new Float32Array(EMBERS), 1).setUsage(THREE.DynamicDrawUsage))
    const seeds = new Float32Array(EMBERS)
    for (let i = 0; i < EMBERS; i++) seeds[i] = fract(Math.sin(i * 91.7) * 43758.5453)
    eg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    this.embers = new THREE.Points(
      eg,
      new THREE.ShaderMaterial({
        vertexShader: emberVert,
        fragmentShader: emberFrag,
        uniforms: { uColor: { value: srgb('#ffcf8f') }, uSize: { value: 0.09 }, uPx: { value: 1 } },
        transparent: true,
        premultipliedAlpha: true,
        depthWrite: false,
      }),
    )
    this.embers.frustumCulled = false
    this.embers.renderOrder = 3
    this.scene.add(this.embers)

    // ── lifecycle ───────────────────────────────────────────────
    this.io = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting
      this.syncLoop()
    })
    this.io.observe(container)
    this.ro = new ResizeObserver(() => this.layout())
    this.ro.observe(container)
    if (opts.stage) this.ro.observe(opts.stage)

    const onMove = (e: PointerEvent) => {
      this.mouse.tx = (e.clientX / window.innerWidth) * 2 - 1
      this.mouse.ty = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    const onVis = () => this.syncLoop()
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('visibilitychange', onVis)
    this.disposers.push(
      () => window.removeEventListener('pointermove', onMove),
      () => document.removeEventListener('visibilitychange', onVis),
    )

    this.layout()
    this.place(0, true)
    this.syncLoop()
  }

  /** 0 → 1: how much of the line has been drawn. */
  setProgress(p: number) {
    this.target = Math.min(1, Math.max(0, p))
  }

  /** per-ring stroke weight: heavier on downstrokes, tapered at both ends — like pen pressure */
  private pressure() {
    const out = new Float32Array((TUBULAR + 1) * (RADIAL + 1))
    const t = new THREE.Vector3()
    for (let i = 0; i <= TUBULAR; i++) {
      const u = i / TUBULAR
      this.curve.getTangentAt(u, t)
      let w = 0.62 + 0.58 * smoothstep(0.1, -0.75, t.y) + 0.08 * Math.sin(u * 47.0)
      w *= 0.3 + 0.7 * smoothstep(0, 0.018, u)
      w *= 0.12 + 0.88 * (1 - smoothstep(0.95, 1, u))
      out.fill(w, i * (RADIAL + 1), (i + 1) * (RADIAL + 1))
    }
    return out
  }

  private buildPen() {
    const lathe = (profile: [number, number][], mat: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 64), mat)
      this.pen.add(mesh)
    }
    const gold = new THREE.MeshPhysicalMaterial({ color: '#e6b86c', metalness: 1, roughness: 0.2 })
    const nib = new THREE.MeshPhysicalMaterial({ color: '#f1d29a', metalness: 1, roughness: 0.14 })
    const grip = new THREE.MeshPhysicalMaterial({ color: '#171210', metalness: 0, roughness: 0.66, clearcoat: 0.25, clearcoatRoughness: 0.55 })
    const lacquer = new THREE.MeshPhysicalMaterial({
      color: '#3b1d1c',
      metalness: 0,
      roughness: 0.34,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      sheen: 0.4,
      sheenColor: new THREE.Color('#e79aa6'),
      sheenRoughness: 0.5,
    })

    // a fine conical nib…
    lathe(
      [
        [0, 0],
        [0.0035, 0.004],
        [0.009, 0.02],
        [0.02, 0.08],
        [0.036, 0.17],
        [0.052, 0.27],
        [0.064, 0.36],
        [0.068, 0.395],
        [0.066, 0.4],
      ],
      nib,
    )
    // …a softly waisted grip…
    lathe(
      [
        [0.066, 0.4],
        [0.073, 0.405],
        [0.078, 0.44],
        [0.075, 0.56],
        [0.075, 0.66],
        [0.079, 0.77],
        [0.084, 0.845],
        [0.085, 0.86],
      ],
      grip,
    )
    // …a candle-gold band…
    lathe(
      [
        [0.085, 0.86],
        [0.0905, 0.866],
        [0.0915, 0.876],
        [0.0915, 0.934],
        [0.0905, 0.944],
        [0.086, 0.95],
      ],
      gold,
    )
    // …and a long lacquered body with a rounded cap
    lathe(
      [
        [0.086, 0.95],
        [0.0885, 0.96],
        [0.0902, 1.3],
        [0.0902, 1.9],
        [0.0885, 2.3],
        [0.083, 2.44],
        [0.074, 2.52],
        [0.058, 2.575],
        [0.035, 2.598],
        [0, 2.605],
      ],
      lacquer,
    )
    // a hairline gold ring near the cap
    lathe(
      [
        [0.087, 2.262],
        [0.0908, 2.268],
        [0.0908, 2.292],
        [0.087, 2.298],
      ],
      gold,
    )
  }

  private layout() {
    const { container, stage } = this.opts
    const W = container.clientWidth
    const H = container.clientHeight
    if (!W || !H) return
    this.renderer.setSize(W, H)
    this.camera.aspect = W / H
    this.camera.updateProjectionMatrix()

    // world units per CSS pixel on the drawing plane (z = 0)
    const upp = (2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2))) / H
    let rect = { x: 0, y: 0, w: W, h: H }
    if (stage) {
      const s = stage.getBoundingClientRect()
      const c = container.getBoundingClientRect()
      if (s.width && s.height) rect = { x: s.left - c.left, y: s.top - c.top, w: s.width, h: s.height }
    }
    const S = Math.min(rect.w, rect.h / this.aspect) * upp * 0.94
    const cx = (rect.x + rect.w / 2 - W / 2) * upp
    const cy = -(rect.y + rect.h / 2 - H / 2) * upp
    this.scale = S
    this.strokeGroup.scale.setScalar(S)
    this.strokeGroup.position.set(cx - S / 2, cy - (S * this.aspect) / 2, 0)
    this.strokeGroup.updateMatrixWorld(true)

    this.penScale = THREE.MathUtils.clamp(S * 0.3, 1.3, 2.5) / PEN_LENGTH
    this.pen.scale.setScalar(this.penScale)
    this.tipGlow.scale.setScalar(S * 0.05)
    this.embers.material.uniforms.uSize.value = S * 0.008
    this.embers.material.uniforms.uPx.value = H * this.renderer.getPixelRatio() * 0.5 / Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    this.tipLight.distance = S * 0.2

    if (!this.running) this.render()
  }

  private syncLoop() {
    const should = this.visible && !document.hidden
    if (should === this.running) return
    this.running = should
    this.renderer.setAnimationLoop(should ? () => this.tick() : null)
    if (should) this.clock.getDelta()
  }

  /** put the pen on the curve at `head`, oriented with a little drag, wobble and lift */
  private place(dt: number, snap = false) {
    const { p, t, a, w } = this.tmp
    const time = this.clock.elapsedTime
    const h = this.head

    this.curve.getPointAt(h, p)
    this.strokeGroup.localToWorld(p)
    p.z += STROKE_RADIUS * this.scale
    this.curve.getTangentAt(h, t)

    // the nib trails its direction of travel slightly; the hand never stays perfectly still
    w.set(
      Math.sin(time * 1.3) * 0.025 + Math.sin(time * 3.7 + 1.2) * 0.012,
      Math.cos(time * 1.1) * 0.02 + Math.sin(time * 4.9) * 0.008,
      Math.sin(time * 0.9 + 2.0) * 0.015,
    )
    a.copy(BASE_AXIS).addScaledVector(t, -0.24 * (0.4 + this.energy)).add(w).normalize()
    if (snap) this.axis.copy(a)
    else this.axis.lerp(a, damp(dt, 5)).normalize()
    this.pen.quaternion.setFromUnitVectors(UP, this.axis)

    // lifted off the page before the first stroke and after the last
    const liftTarget = 0.5 * (1 - smoothstep(0, 0.008, h)) + 0.65 * smoothstep(0.992, 1, h)
    this.lift = snap ? liftTarget : this.lift + (liftTarget - this.lift) * damp(dt, 4)
    const bob = Math.sin(time * 1.6) * 0.03 * this.lift
    const lift = (this.lift + bob) * this.penScale * PEN_LENGTH * 0.25
    this.pen.position.copy(p).addScaledVector(this.axis, lift * 0.55)
    this.pen.position.z += lift * 0.45

    const touching = 1 - smoothstep(0.05, 0.25, this.lift)
    this.tipGlow.position.copy(p)
    this.tipGlow.quaternion.copy(this.camera.quaternion)
    this.tipGlow.material.uniforms.uIntensity.value = touching * (0.35 + this.energy * 0.9)
    // the fresh ink throws a little warm light back up onto the nib
    this.tipLight.position.set(p.x, p.y - 0.008 * this.scale, p.z + 0.018 * this.scale)
    this.tipLight.intensity = touching * (0.03 + this.energy * 0.08)
    return touching
  }

  private tick() {
    const dt = Math.min(this.clock.getDelta(), 1 / 20)
    const time = this.clock.elapsedTime

    const prev = this.head
    this.head += (this.target - this.head) * damp(dt, 11)
    if (Math.abs(this.target - this.head) < 1e-5) this.head = this.target
    const speed = Math.abs(this.head - prev) / Math.max(dt, 1e-4) // path fraction / s
    this.energy += (Math.min(1, speed * 6) - this.energy) * damp(dt, 6)

    const count = Math.floor(this.head * TUBULAR) * RADIAL * 6
    this.tube.setDrawRange(0, count)
    for (const m of [this.coreMat, this.glowMat]) {
      m.uniforms.uHead.value = this.head
      m.uniforms.uEnergy.value = this.energy
    }

    this.mouse.x += (this.mouse.tx - this.mouse.x) * damp(dt, 3)
    this.mouse.y += (this.mouse.ty - this.mouse.y) * damp(dt, 3)
    this.camera.position.set(this.mouse.x * 0.45, this.mouse.y * 0.3, CAM_Z)
    this.camera.lookAt(this.mouse.x * 0.1, this.mouse.y * 0.06, 0)

    const touching = this.place(dt)
    this.updateEmbers(dt, time, touching)
    this.render()
  }

  private updateEmbers(dt: number, time: number, touching: number) {
    const geo = this.embers.geometry
    const pos = geo.attributes.position as THREE.BufferAttribute
    const life = geo.attributes.aLife as THREE.BufferAttribute
    const P = pos.array as Float32Array
    const L = life.array as Float32Array
    const V = this.emberVel
    const s = this.scale

    this.emberBudget += touching * this.energy * dt * 70
    while (this.emberBudget >= 1) {
      this.emberBudget -= 1
      const i = this.emberCursor
      this.emberCursor = (i + 1) % EMBERS
      const tip = this.tipGlow.position
      const r1 = fract(Math.sin((time + i) * 12.9898) * 43758.5453)
      const r2 = fract(Math.sin((time + i) * 78.233) * 12345.678)
      P[i * 3] = tip.x
      P[i * 3 + 1] = tip.y
      P[i * 3 + 2] = tip.z
      V[i * 3] = (r1 - 0.5) * 0.06 * s
      V[i * 3 + 1] = (0.02 + r2 * 0.05) * s
      V[i * 3 + 2] = (r2 - 0.3) * 0.03 * s
      L[i] = 1
    }
    for (let i = 0; i < EMBERS; i++) {
      if (L[i] <= 0) continue
      L[i] = Math.max(0, L[i] - dt / 1.3)
      V[i * 3] += Math.sin(time * 3 + i) * 0.004 * s * dt
      V[i * 3 + 1] += 0.012 * s * dt // heat rises
      P[i * 3] += V[i * 3] * dt
      P[i * 3 + 1] += V[i * 3 + 1] * dt
      P[i * 3 + 2] += V[i * 3 + 2] * dt
    }
    pos.needsUpdate = true
    life.needsUpdate = true
  }

  private render() {
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.renderer.setAnimationLoop(null)
    this.running = false
    this.io.disconnect()
    this.ro.disconnect()
    this.disposers.forEach((d) => d())
    const geos = new Set<THREE.BufferGeometry>()
    const mats = new Set<THREE.Material>()
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line || o instanceof THREE.Points) {
        geos.add(o.geometry)
        ;(Array.isArray(o.material) ? o.material : [o.material]).forEach((m: THREE.Material) => mats.add(m))
      }
    })
    geos.forEach((g) => g.dispose())
    mats.forEach((m) => m.dispose())
    this.scene.environment = null
    this.envRT.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss() // free the context now rather than whenever GC gets to it
    this.renderer.domElement.remove()
  }
}

function fract(x: number) {
  return x - Math.floor(x)
}
