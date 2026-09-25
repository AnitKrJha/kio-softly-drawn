import * as THREE from 'three'
import gsap from 'gsap'
import { texture, type Artwork } from '../data/artworks'
import { NOISE_GLSL } from './noise'

export interface HeroGLOptions {
  container: HTMLElement
  artworks: Artwork[]
  onHover: (art: Artwork | null) => void
  onSelect: (art: Artwork) => void
  getVelocity: () => number
}

/*
 * Colour pipeline: artwork textures stay `NoColorSpace` and ShaderMaterial output is not
 * converted, so every colour below is authored as a raw sRGB triplet (what you see in CSS).
 * Never pass a THREE.Color into these shaders — it would be silently linearised.
 */
const INK = new THREE.Vector3(14 / 255, 11 / 255, 9 / 255)

const RADIUS = 5.2
const COUNT = 12
const HEIGHT = 2.25
const MAX_WIDTH = 2.35
const TILT = 0.17
const RING_Y = 0.45
const CAM_Z = 12
/** Half-width (world units) of the ring's centre plane we try to keep in frame. */
const FRAME_HALF_WIDTH = 6.1
const MAX_DPR = 1.5
/** Slot → artwork index. Twins never sit side by side or directly opposite each other. */
const SEQUENCE = [0, 1, 2, 3, 4, 5, 2, 0, 4, 1, 5, 3]

const backdropVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.999, 1.0);
  }
`

const backdropFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uMouse;
  uniform vec2 uRes;
  uniform float uProgress;
  ${NOISE_GLSL}

  // 4 octaves is visually identical here and ~20% cheaper per full-screen pixel
  float fbm4(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = r * p * 2.02;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uRes.x / uRes.y;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
    float t = uTime * 0.035;

    // domain-warped ink wash
    vec2 q = vec2(fbm4(p * 1.4 + t), fbm4(p * 1.4 - t + 3.1));
    float n = fbm4(p * 1.2 + q * 1.7 + vec2(t * 0.6, -t * 0.4));

    vec3 ink = vec3(0.055, 0.043, 0.035);
    vec3 ember = vec3(0.19, 0.105, 0.07);
    vec3 rose = vec3(0.30, 0.13, 0.17);
    vec3 candle = vec3(0.91, 0.72, 0.42);

    vec3 col = mix(ink, ember, smoothstep(0.35, 0.9, n));
    col = mix(col, rose, smoothstep(0.55, 0.95, q.y) * 0.45);

    // a low pool of warm light the ring sits in
    col += candle * 0.05 * exp(-length((p - vec2(0.0, -0.12)) * vec2(0.8, 1.7)) * 2.2);

    // candle glow that follows the cursor
    vec2 m = (uMouse - 0.5) * vec2(aspect, 1.0);
    float glow = exp(-length(p - m) * 2.4);
    col += candle * glow * 0.15 * (0.55 + 0.45 * n);

    // (smoothstep needs edge0 < edge1 — reversed edges are undefined in GLSL)
    float vig = 1.0 - smoothstep(0.2, 1.25, length(p * vec2(0.85, 1.1)));
    col *= mix(0.4, 1.0, vig);
    col *= 1.0 - uProgress * 0.55;

    // dither — kills banding in the dark gradients
    col += (hash(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * 0.03;
    gl_FragColor = vec4(col, 1.0);
  }
`

const artVert = /* glsl */ `
  uniform float uVel;
  uniform float uHover;
  uniform float uTime;
  uniform float uRadius;
  varying vec2 vUv;
  varying float vDepth;

  void main() {
    vUv = uv;
    vec3 p = position;
    // hug the ring's curvature (local +z points away from the ring's centre)
    p.z -= (p.x * p.x) / (2.0 * uRadius);
    // velocity ripple — the canvases "breathe" as the ring spins
    p.z += sin(uv.y * 3.14159) * uVel * 0.45;
    p.x += sin(uv.y * 6.2831 + uTime * 2.0) * uVel * 0.04;
    // hovered canvas lifts toward the viewer
    p.xy *= 1.0 + uHover * 0.06;
    p.z += uHover * 0.18;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vDepth = world.z;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const artFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D uTex;
  uniform float uVel;
  uniform float uHover;
  uniform float uReveal;
  uniform float uFade;
  uniform vec2 uSize;
  uniform vec3 uFog;
  varying vec2 vUv;
  varying float vDepth;
  ${NOISE_GLSL}

  float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    vec2 uv = vUv;

    // rounded corners, anti-aliased (alpha-to-coverage turns alpha into MSAA coverage)
    float d = sdRoundBox((uv - 0.5) * uSize, uSize * 0.5, 0.06);
    float aa = max(fwidth(d), 1e-4);
    float shape = 1.0 - smoothstep(-aa, aa, d);

    // brush-stroke reveal: a noisy front sweeps up the canvas (front spans ~0 … 1.25)
    float n = noise(uv * vec2(5.0, 8.0)) * 0.6 + noise(uv * vec2(28.0, 6.0)) * 0.4;
    float front = uv.y * 0.75 + n * 0.5;
    float r = uReveal * 1.32;
    float fw = max(fwidth(front), 1e-4);
    float paint = 1.0 - smoothstep(r - fw, r + fw, front);

    float alpha = shape * paint;

    // wet, candle-lit edge on the advancing stroke — fades out as the reveal completes
    float rim = smoothstep(r - 0.08, r, front) * (1.0 - smoothstep(0.82, 1.0, uReveal));

    // all sampling happens in uniform control flow, before any discard, so mip
    // derivatives stay defined along the reveal front and the rounded corners
    vec2 tuv = (uv - 0.5) * (1.0 - uHover * 0.07) + 0.5;
    float s = uVel * 0.012;
    vec3 faceCol = vec3(
      texture2D(uTex, tuv + vec2(s, 0.0)).r,
      texture2D(uTex, tuv).g,
      texture2D(uTex, tuv - vec2(s, 0.0)).b
    );
    // seen from behind: un-mirror and sink into shadow
    vec3 backCol = texture2D(uTex, vec2(1.0 - tuv.x, tuv.y)).rgb * 0.3;
    vec3 col = gl_FrontFacing ? faceCol : backCol;

    // the far side of the ring sinks into the ink
    float fog = 1.0 - smoothstep(-4.5, 2.8, vDepth);
    col = mix(col, uFog, fog * 0.85);
    col *= 0.86 + uHover * 0.2;
    col += vec3(0.98, 0.76, 0.46) * rim;
    col = mix(col, uFog, uFade);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col, alpha);
  }
`

type Plane = {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  mat: THREE.ShaderMaterial
  art: Artwork
  theta: number
}

export class HeroGL {
  readonly ready: Promise<void>

  private renderer: THREE.WebGLRenderer
  private canvas: HTMLCanvasElement
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
  private ring = new THREE.Group()
  private planes: Plane[] = []
  private meshes: THREE.Object3D[] = []
  private backdrop: THREE.ShaderMaterial
  private raycaster = new THREE.Raycaster()
  private ndc = new THREE.Vector2()
  private textures = new Set<THREE.Texture>()
  private tweens: gsap.core.Tween[] = []

  private pointer = { x: 0, y: 0, has: false, inside: false, onCanvas: false }
  private mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 }
  private rot = { current: 0, target: 0, prev: 0, vel: 0, idle: 1 }
  private drag = { active: false, x: 0, moved: 0, vx: 0 }
  private hovered: Plane | null = null
  private progress = 0
  private time = 0
  private dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
  private perf = { skip: 45, frames: 0, acc: 0, downgrades: 0 }
  private interactive = false
  private revealed = false
  private visible = true
  private running = false
  private disposed = false

  private io: IntersectionObserver
  private ro: ResizeObserver
  private disposers: (() => void)[] = []

  constructor(private opts: HeroGLOptions) {
    const { container } = opts
    // throws if WebGL is unavailable — callers fall back to the CSS hero
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(this.dpr)
    this.renderer.setClearColor('#0e0b09')
    this.canvas = this.renderer.domElement
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y;'
    this.canvas.setAttribute('aria-hidden', 'true')
    container.appendChild(this.canvas)

    this.backdrop = new THREE.ShaderMaterial({
      vertexShader: backdropVert,
      fragmentShader: backdropFrag,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uRes: { value: new THREE.Vector2(1, 1) },
        uProgress: { value: 0 },
      },
    })
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.backdrop)
    bg.frustumCulled = false
    bg.renderOrder = -1
    this.scene.add(bg)

    this.ring.rotation.x = TILT
    this.ring.position.y = RING_Y
    this.scene.add(this.ring)

    const loader = new THREE.TextureLoader()
    const cache = new Map<string, Promise<THREE.Texture | null>>()
    const load = (url: string) => {
      let p = cache.get(url)
      if (!p) {
        p = loader
          .loadAsync(url)
          .then(async (t) => {
            // decode off the main thread before the (synchronous) GPU upload
            await (t.image as HTMLImageElement).decode?.().catch(() => undefined)
            if (this.disposed) {
              t.dispose()
              return null
            }
            t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy())
            this.textures.add(t)
            this.renderer.initTexture(t)
            return t
          })
          .catch(() => null)
        cache.set(url, p)
      }
      return p
    }

    const arts = opts.artworks
    const loads: Promise<unknown>[] = []
    if (arts.length) {
      for (let i = 0; i < COUNT; i++) {
        const art = arts[SEQUENCE[i % SEQUENCE.length] % arts.length]
        const aspect = art.w / art.h
        let w = HEIGHT * aspect
        let h = HEIGHT
        if (w > MAX_WIDTH) {
          w = MAX_WIDTH
          h = w / aspect
        }
        const mat = new THREE.ShaderMaterial({
          vertexShader: artVert,
          fragmentShader: artFrag,
          side: THREE.DoubleSide,
          alphaToCoverage: true,
          uniforms: {
            uTex: { value: null },
            uVel: { value: 0 },
            uHover: { value: 0 },
            uReveal: { value: 0 },
            uFade: { value: 0 },
            uTime: { value: 0 },
            uRadius: { value: RADIUS },
            uSize: { value: new THREE.Vector2(w, h) },
            uFog: { value: INK },
          },
        })
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 32, 16), mat)
        const theta = (i / COUNT) * Math.PI * 2
        mesh.position.set(Math.sin(theta) * RADIUS, Math.sin(i * 2.4) * 0.22, Math.cos(theta) * RADIUS)
        mesh.rotation.y = theta
        // stays fully discarded (uReveal = 0) until reveal(); planes whose texture never arrives are hidden
        this.ring.add(mesh)
        this.meshes.push(mesh)
        this.planes.push({ mesh, mat, art, theta })
        loads.push(
          load(texture(art)).then((t) => {
            if (!t) {
              mesh.visible = false
              return
            }
            mat.uniforms.uTex.value = t
            mesh.visible = true
          }),
        )
      }
    }

    // warm the shader programs so the reveal never hitches on first draw
    loads.push(this.renderer.compileAsync(this.scene, this.camera).catch(() => undefined))
    // never hang the hero on a stalled request: reveal whatever made it after 8s
    const timeout = new Promise<void>((r) => setTimeout(r, 8000))
    this.ready = Promise.race([Promise.all(loads), timeout]).then(() => undefined)

    this.io = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting
      this.syncLoop()
    })
    this.io.observe(container)
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(container)

    this.bind()
    this.resize()
    this.syncLoop()
  }

  /** Paint the canvases in, front-most first. */
  reveal() {
    if (this.revealed || this.disposed) return
    this.revealed = true
    // never paint an empty (black) canvas — a late texture re-shows its plane when it lands
    for (const p of this.planes) if (!p.mat.uniforms.uTex.value) p.mesh.visible = false
    const rot = this.rot.current
    const order = [...this.planes].sort((a, b) => angleFromFront(a.theta + rot) - angleFromFront(b.theta + rot))
    order.forEach((p, i) => {
      this.tweens.push(
        gsap.to(p.mat.uniforms.uReveal, { value: 1, duration: 2.2, delay: 0.1 + i * 0.08, ease: 'power2.inOut' }),
      )
    })
    // hover/click only once the front canvases are mostly painted
    this.tweens.push(gsap.delayedCall(1.2, () => (this.interactive = true)))
    this.rot.target += 0.9 // a little flourish of spin that settles into the idle drift
  }

  /** 0 → 1 as the hero scrolls out of view. */
  setProgress(p: number) {
    this.progress = THREE.MathUtils.clamp(p, 0, 1)
  }

  private bind() {
    const el = this.canvas
    const on = <E extends Event>(target: EventTarget, type: string, fn: (e: E) => void, passive = true) => {
      target.addEventListener(type, fn as EventListener, { passive })
      this.disposers.push(() => target.removeEventListener(type, fn as EventListener))
    }

    on<PointerEvent>(window, 'pointermove', (e) => {
      this.pointer.x = e.clientX
      this.pointer.y = e.clientY
      this.pointer.has = true
      this.pointer.inside = true
      this.pointer.onCanvas = e.target === el || this.drag.active
      if (this.drag.active) {
        const dx = e.clientX - this.drag.x
        this.drag.x = e.clientX
        this.drag.moved += Math.abs(dx)
        this.drag.vx = this.drag.vx * 0.6 + dx * 0.4
        this.rot.target += dx * 0.0045
      }
    })
    on<PointerEvent>(el, 'pointerdown', (e) => {
      if (e.button !== 0) return
      this.drag = { active: true, x: e.clientX, moved: 0, vx: 0 }
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* capture is a nicety */
      }
    })
    const end = (e?: Event) => {
      if (!this.drag.active) return
      const wasClick = this.drag.moved < 6
      this.drag.active = false
      if (wasClick) {
        if (e?.type === 'pointerup' && this.hovered) this.opts.onSelect(this.hovered.art)
      } else {
        // fling: keep a little of the release momentum
        this.rot.target += THREE.MathUtils.clamp(this.drag.vx, -40, 40) * 0.0045 * 8
      }
    }
    on(window, 'pointerup', end)
    on(window, 'pointercancel', end)
    on(window, 'blur', () => {
      end()
      this.pointer.inside = false
    })
    on<MouseEvent>(window, 'mouseout', (e) => {
      if (!e.relatedTarget) this.pointer.inside = false
    })
    on(document, 'visibilitychange', () => this.syncLoop())
  }

  private syncLoop() {
    const should = this.visible && !document.hidden && !this.disposed
    if (should === this.running) return
    this.running = should
    if (should) {
      this.perf.skip = 30 // ignore warm-up frames when measuring
      gsap.ticker.add(this.tick)
    } else {
      gsap.ticker.remove(this.tick)
    }
  }

  private resize() {
    if (this.disposed) return
    const { container } = this.opts
    const w = Math.max(1, container.clientWidth)
    const h = Math.max(1, container.clientHeight)
    this.renderer.setPixelRatio(this.dpr)
    this.renderer.setSize(w, h, false)
    const aspect = w / h
    this.camera.aspect = aspect
    // keep the ring's width framed at any aspect; clamp so ultra-wide doesn't go telephoto
    // and narrow windows crop the ring's sides rather than shrinking it to nothing
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(FRAME_HALF_WIDTH / CAM_Z / aspect))
    this.camera.fov = THREE.MathUtils.clamp(fov, 30, 50)
    this.camera.updateProjectionMatrix()
    this.backdrop.uniforms.uRes.value.set(w, h)
  }

  private tick = (_time: number, deltaMs: number) => {
    const dt = Math.min(deltaMs / 1000, 1 / 20)
    const f = Math.max(dt * 60, 0.0001)
    const k = (rate: number) => 1 - Math.pow(1 - rate, f)
    this.time += dt
    this.measure(dt)

    // pointer in canvas space
    if (this.pointer.has) {
      const rect = this.canvas.getBoundingClientRect()
      const mx = (this.pointer.x - rect.left) / rect.width
      const my = (this.pointer.y - rect.top) / rect.height
      this.mouse.tx = THREE.MathUtils.clamp(mx, 0, 1)
      this.mouse.ty = THREE.MathUtils.clamp(1 - my, 0, 1)
      this.ndc.set(mx * 2 - 1, -(my * 2 - 1))
    }
    this.mouse.x += (this.mouse.tx - this.mouse.x) * k(0.06)
    this.mouse.y += (this.mouse.ty - this.mouse.y) * k(0.06)

    // rotation: idle drift (slows while a canvas is hovered) + scroll velocity + drag
    const scrollVel = THREE.MathUtils.clamp(this.opts.getVelocity() || 0, -80, 80)
    this.rot.idle += ((this.hovered ? 0.12 : 1) - this.rot.idle) * k(0.05)
    if (!this.drag.active) this.rot.target += 0.0016 * this.rot.idle * f + scrollVel * 0.0011
    this.rot.current += (this.rot.target - this.rot.current) * k(0.075)
    const perFrame = (this.rot.current - this.rot.prev) / f
    this.rot.prev = this.rot.current
    this.rot.vel += (THREE.MathUtils.clamp(perFrame * 22, -1, 1) - this.rot.vel) * k(0.12)
    this.ring.rotation.y = this.rot.current

    const p = this.progress
    const bu = this.backdrop.uniforms
    bu.uMouse.value.set(this.mouse.x, this.mouse.y)
    bu.uTime.value = this.time
    bu.uProgress.value = p

    this.camera.position.set((this.mouse.x - 0.5) * 0.8, (this.mouse.y - 0.5) * 0.5 + p * 2.2, CAM_Z + p * 5)
    this.camera.lookAt(0, -p * 1.2, 0)
    this.ring.rotation.x = TILT + p * 0.45
    // raycasting needs up-to-date world matrices before render() would compute them
    this.scene.updateMatrixWorld()
    this.camera.updateMatrixWorld()

    this.updateHover()

    for (const plane of this.planes) {
      const u = plane.mat.uniforms
      u.uTime.value = this.time
      u.uVel.value = this.rot.vel
      u.uFade.value = p * 0.7
      const target = plane === this.hovered ? 1 : 0
      u.uHover.value += (target - u.uHover.value) * k(0.1)
    }

    this.renderer.render(this.scene, this.camera)
  }

  /** Drop resolution on GPUs that can't hold ~48fps; the grain overlay hides the softness. */
  private measure(dt: number) {
    if (this.perf.downgrades >= 2 || this.dpr <= 1) return
    if (this.perf.skip > 0) {
      this.perf.skip--
      return
    }
    this.perf.frames++
    this.perf.acc += dt
    if (this.perf.frames < 90) return
    const avg = this.perf.acc / this.perf.frames
    this.perf.frames = 0
    this.perf.acc = 0
    if (avg > 1 / 48) {
      this.dpr = Math.max(1, this.dpr - 0.25)
      this.perf.downgrades++
      this.perf.skip = 30
      this.resize()
    }
  }

  private updateHover() {
    let next: Plane | null = null
    const dragging = this.drag.active && this.drag.moved > 6
    if (this.interactive && this.pointer.has && this.pointer.inside && this.pointer.onCanvas && !dragging) {
      this.raycaster.setFromCamera(this.ndc, this.camera)
      const hits = this.raycaster.intersectObjects(this.meshes, false)
      // only the side of the ring facing the viewer is clickable
      const hit = hits.find((h) => h.point.z > 0 && h.object.visible)
      if (hit) next = this.planes.find((p) => p.mesh === hit.object) ?? null
    }
    if (next !== this.hovered) {
      this.hovered = next
      this.opts.onHover(next?.art ?? null)
      this.canvas.style.cursor = next ? 'pointer' : ''
    }
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    gsap.ticker.remove(this.tick)
    this.running = false
    this.tweens.forEach((t) => t.kill())
    this.io.disconnect()
    this.ro.disconnect()
    this.disposers.forEach((d) => d())
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose()
        ;(o.material as THREE.Material).dispose()
      }
    })
    this.textures.forEach((t) => t.dispose())
    this.textures.clear()
    this.renderer.dispose()
    // free the context now rather than at GC — route hops would otherwise pile up contexts
    this.renderer.forceContextLoss()
    this.canvas.remove()
  }
}

/** Absolute angular distance (0…π) from the ring's front (+z, facing the camera). */
function angleFromFront(theta: number) {
  const tau = Math.PI * 2
  const a = ((theta % tau) + tau) % tau
  return Math.min(a, tau - a)
}
