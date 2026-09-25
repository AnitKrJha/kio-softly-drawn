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

const RADIUS = 5.2
const COUNT = 12
const HEIGHT = 2.25
const MAX_WIDTH = 2.6
const FOG = new THREE.Color('#0e0b09')

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

  void main() {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
    float t = uTime * 0.035;

    // domain-warped ink wash
    vec2 q = vec2(fbm(p * 1.4 + t), fbm(p * 1.4 - t + 3.1));
    float n = fbm(p * 1.2 + q * 1.7 + vec2(t * 0.6, -t * 0.4));

    vec3 ink = vec3(0.055, 0.043, 0.036);
    vec3 ember = vec3(0.19, 0.105, 0.07);
    vec3 rose = vec3(0.30, 0.13, 0.17);
    vec3 candle = vec3(0.91, 0.72, 0.42);

    vec3 col = mix(ink, ember, smoothstep(0.35, 0.9, n));
    col = mix(col, rose, smoothstep(0.55, 0.95, q.y) * 0.45);

    // candle glow that follows the cursor
    vec2 m = (uMouse - 0.5) * vec2(uRes.x / uRes.y, 1.0);
    float glow = exp(-length(p - m) * 2.4);
    col += candle * glow * 0.15 * (0.55 + 0.45 * n);

    float vig = smoothstep(1.25, 0.2, length(p * vec2(0.85, 1.1)));
    col *= mix(0.4, 1.0, vig);
    col *= 1.0 - uProgress * 0.55;

    col += (hash(uv * uRes + fract(uTime) * 91.0) - 0.5) * 0.035;
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
    // hug the ring's curvature
    p.z -= (p.x * p.x) / (2.0 * uRadius);
    // velocity ripple — the canvas "breathes" as it spins
    p.z += sin(uv.y * 3.14159) * uVel * 0.45;
    p.x += sin(uv.y * 6.2831 + uTime * 2.0) * uVel * 0.04;
    p.xy *= 1.0 + uHover * 0.06;
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
    if (sdRoundBox((uv - 0.5) * uSize, uSize * 0.5, 0.05) > 0.0) discard;

    // brush-stroke reveal: a noisy front sweeps up the canvas
    float n = noise(uv * vec2(5.0, 8.0)) * 0.6 + noise(uv * vec2(28.0, 6.0)) * 0.4;
    float front = uv.y * 0.75 + n * 0.5;
    float r = uReveal * 1.3;
    if (front > r) discard;
    float rim = smoothstep(r - 0.07, r, front) * step(uReveal, 0.999);

    vec2 tuv = (uv - 0.5) * (1.0 - uHover * 0.07) + 0.5;
    vec3 col;
    if (gl_FrontFacing) {
      float s = uVel * 0.012;
      col.r = texture2D(uTex, tuv + vec2(s, 0.0)).r;
      col.g = texture2D(uTex, tuv).g;
      col.b = texture2D(uTex, tuv - vec2(s, 0.0)).b;
    } else {
      col = texture2D(uTex, vec2(1.0 - tuv.x, tuv.y)).rgb * 0.3;
    }

    // the far side of the ring sinks into the ink
    float fog = smoothstep(2.8, -4.5, vDepth);
    col = mix(col, uFog, fog * 0.85);
    col *= 0.86 + uHover * 0.2;
    col += vec3(0.98, 0.76, 0.46) * rim;
    col = mix(col, uFog, uFade);
    gl_FragColor = vec4(col, 1.0);
  }
`

export class HeroGL {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
  private ring = new THREE.Group()
  private planes: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; art: Artwork; theta: number }[] = []
  private backdrop: THREE.ShaderMaterial
  private raycaster = new THREE.Raycaster()
  private clock = new THREE.Clock()
  private pointer = new THREE.Vector2(0, 0)
  private mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 }
  private rot = { current: 0, target: 0, prev: 0, vel: 0 }
  private drag = { active: false, x: 0, moved: 0 }
  private hovered: (typeof this.planes)[number] | null = null
  private progress = 0
  private visible = true
  private running = false
  private io: IntersectionObserver
  private disposers: (() => void)[] = []
  readonly ready: Promise<void>

  constructor(private opts: HeroGLOptions) {
    const { container } = opts
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    this.renderer.setClearColor(FOG)
    container.appendChild(this.renderer.domElement)

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

    this.ring.rotation.x = 0.17
    this.ring.position.y = -0.35
    this.scene.add(this.ring)

    const loader = new THREE.TextureLoader()
    const cache = new Map<string, Promise<THREE.Texture>>()
    const load = (url: string) => {
      if (!cache.has(url)) {
        cache.set(
          url,
          loader.loadAsync(url).then((t) => {
            t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy())
            return t
          }),
        )
      }
      return cache.get(url)!
    }

    const loads: Promise<unknown>[] = []
    for (let i = 0; i < COUNT; i++) {
      const art = opts.artworks[i % opts.artworks.length]
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
        uniforms: {
          uTex: { value: null },
          uVel: { value: 0 },
          uHover: { value: 0 },
          uReveal: { value: 0 },
          uFade: { value: 0 },
          uTime: { value: 0 },
          uRadius: { value: RADIUS },
          uSize: { value: new THREE.Vector2(w, h) },
          uFog: { value: FOG },
        },
      })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 32, 16), mat)
      const theta = (i / COUNT) * Math.PI * 2
      mesh.position.set(Math.sin(theta) * RADIUS, Math.sin(i * 2.4) * 0.22, Math.cos(theta) * RADIUS)
      mesh.rotation.y = theta
      this.ring.add(mesh)
      this.planes.push({ mesh, mat, art, theta })
      loads.push(load(texture(art)).then((t) => (mat.uniforms.uTex.value = t)))
    }
    this.ready = Promise.all(loads).then(() => undefined)

    this.io = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting
      this.syncLoop()
    })
    this.io.observe(container)

    this.bind()
    this.resize()
    this.syncLoop()
  }

  /** Paint the canvases in, front-most first. */
  reveal() {
    const order = [...this.planes].sort((a, b) => angleFromFront(a.theta) - angleFromFront(b.theta))
    order.forEach((p, i) => {
      gsap.to(p.mat.uniforms.uReveal, { value: 1, duration: 2.2, delay: 0.1 + i * 0.09, ease: 'power2.inOut' })
    })
    this.rot.target -= 1.1 // a little flourish of spin on entry
  }

  setProgress(p: number) {
    this.progress = p
  }

  private bind() {
    const el = this.renderer.domElement
    const on = <E extends Event = PointerEvent>(target: EventTarget, type: string, fn: (e: E) => void) => {
      target.addEventListener(type, fn as EventListener, { passive: true })
      this.disposers.push(() => target.removeEventListener(type, fn as EventListener))
    }

    on(window, 'resize', () => this.resize())
    on(window, 'pointermove', (e) => {
      this.mouse.tx = e.clientX / window.innerWidth
      this.mouse.ty = 1 - e.clientY / window.innerHeight
      const rect = el.getBoundingClientRect()
      this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      if (this.drag.active) {
        const dx = e.clientX - this.drag.x
        this.drag.x = e.clientX
        this.drag.moved += Math.abs(dx)
        this.rot.target += dx * 0.0045
      }
    })
    on(el, 'pointerdown', (e) => {
      this.drag = { active: true, x: e.clientX, moved: 0 }
    })
    on(window, 'pointerup', () => {
      const wasClick = this.drag.active && this.drag.moved < 6
      this.drag.active = false
      if (wasClick && this.hovered) this.opts.onSelect(this.hovered.art)
    })
    on(document, 'visibilitychange', () => this.syncLoop())
  }

  private syncLoop() {
    const should = this.visible && !document.hidden
    if (should === this.running) return
    this.running = should
    this.renderer.setAnimationLoop(should ? () => this.tick() : null)
    if (should) this.clock.getDelta()
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.opts.container
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    // keep the ring comfortably framed on narrower desktop windows
    this.camera.fov = w / h < 1.3 ? 44 : 35
    this.camera.updateProjectionMatrix()
    this.backdrop.uniforms.uRes.value.set(w, h)
  }

  private tick() {
    const dt = Math.min(this.clock.getDelta(), 1 / 20)
    const time = this.clock.elapsedTime
    const f = dt * 60

    const scrollVel = this.opts.getVelocity()
    if (!this.drag.active) this.rot.target += 0.0016 * f + scrollVel * 0.0011
    this.rot.current += (this.rot.target - this.rot.current) * (1 - Math.pow(1 - 0.075, f))
    const delta = this.rot.current - this.rot.prev
    this.rot.prev = this.rot.current
    this.rot.vel += (THREE.MathUtils.clamp(delta * 22, -1, 1) - this.rot.vel) * 0.12
    this.ring.rotation.y = this.rot.current

    this.mouse.x += (this.mouse.tx - this.mouse.x) * 0.06
    this.mouse.y += (this.mouse.ty - this.mouse.y) * 0.06
    this.backdrop.uniforms.uMouse.value.set(this.mouse.x, this.mouse.y)
    this.backdrop.uniforms.uTime.value = time
    this.backdrop.uniforms.uProgress.value = this.progress

    const p = this.progress
    this.camera.position.set((this.mouse.x - 0.5) * 0.8, (this.mouse.y - 0.5) * 0.5 + p * 2.2, 12 + p * 5)
    this.camera.lookAt(0, -p * 1.2, 0)
    this.ring.rotation.x = 0.17 + p * 0.45

    this.updateHover()

    for (const plane of this.planes) {
      const u = plane.mat.uniforms
      u.uTime.value = time
      u.uVel.value = this.rot.vel
      u.uFade.value = p * 0.7
      const target = plane === this.hovered ? 1 : 0
      u.uHover.value += (target - u.uHover.value) * 0.1
    }

    this.renderer.render(this.scene, this.camera)
  }

  private updateHover() {
    if (this.drag.active && this.drag.moved > 6) return
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(
      this.planes.map((p) => p.mesh),
      false,
    )
    // only the side of the ring facing the viewer is clickable
    const hit = hits.find((h) => h.point.z > 0)
    const next = hit ? (this.planes.find((p) => p.mesh === hit.object) ?? null) : null
    if (next !== this.hovered) {
      this.hovered = next
      this.opts.onHover(next?.art ?? null)
      this.renderer.domElement.style.cursor = next ? 'pointer' : ''
    }
  }

  dispose() {
    this.renderer.setAnimationLoop(null)
    this.io.disconnect()
    this.disposers.forEach((d) => d())
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose()
        const mat = o.material as THREE.ShaderMaterial
        ;(mat.uniforms?.uTex?.value as THREE.Texture | null)?.dispose()
        mat.dispose()
      }
    })
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}

function angleFromFront(theta: number) {
  const a = ((theta + Math.PI) % (Math.PI * 2)) - Math.PI
  return Math.abs(a)
}
