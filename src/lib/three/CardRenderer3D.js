/**
 * CardRenderer3D.js
 *
 * Three.js base for a 3D card game.
 * Design goals:
 *   - Minimum draw calls: one PlaneGeometry shared by all cards (guideline 1)
 *   - MeshPhongMaterial with front/back textures (guideline 2)
 *   - Smooth flip via exponential lerp, zero dependencies (guideline 3)
 *   - AmbientLight + one DirectionalLight, castShadow = false (guideline 4)
 *   - Raycaster via pointer/touch events (guideline 5)
 *
 * Install: npm install three
 * Usage: see bottom of file or /public/three-demo.html
 */

import * as THREE from 'three';

// ─── Shared geometry (module-level singleton) ─────────────────────────────────
// Every Card3D instance reuses the SAME PlaneGeometry on the GPU.
// PlaneGeometry(w, h) = 2 triangles, 4 vertices — the absolute minimum.
// Standard poker card ratio ≈ 2.5 : 3.5 → 0.714 (close to 5:7).
const SHARED_GEOMETRY = new THREE.PlaneGeometry(0.714, 1.0);

// ─── Card3D ───────────────────────────────────────────────────────────────────
/**
 * A single 3D card made of two meshes (front face + back face) sharing
 * the same PlaneGeometry. The Group is the card's transform node.
 *
 * Memory layout per card:
 *   - 0 extra geometry allocations (shared)
 *   - 2 MeshPhongMaterial instances
 *   - 0 to 2 Texture references (caller owns them)
 */
export class Card3D {
  /**
   * @param {THREE.Texture} frontTexture  - face of the card
   * @param {THREE.Texture} backTexture   - card back / cover
   * @param {object}        [meta={}]     - arbitrary data (suit, value, id…)
   */
  constructor(frontTexture, backTexture, meta = {}) {
    this.meta = meta;

    // ── Materials ──────────────────────────────────────────────────────────
    // MeshPhongMaterial = diffuse + specular highlight, cheap on mobile.
    // MeshBasicMaterial would be even lighter but loses the "table lamp" feel.
    const frontMat = new THREE.MeshPhongMaterial({
      map:       frontTexture,
      side:      THREE.FrontSide,
      shininess: 30,
    });
    const backMat = new THREE.MeshPhongMaterial({
      map:       backTexture,
      side:      THREE.BackSide,  // rendered from the other side of the plane
      shininess: 20,
    });

    // ── Meshes ─────────────────────────────────────────────────────────────
    this.frontMesh = new THREE.Mesh(SHARED_GEOMETRY, frontMat);
    this.backMesh  = new THREE.Mesh(SHARED_GEOMETRY, backMat);

    // Tag meshes so raycaster hits can look up their owner card in O(1)
    this.frontMesh.userData.card = this;
    this.backMesh.userData.card  = this;

    // ── Group (transform node) ─────────────────────────────────────────────
    this.group = new THREE.Group();
    this.group.add(this.frontMesh, this.backMesh);

    // ── Flip state ─────────────────────────────────────────────────────────
    this._angle    = 0;        // current Y rotation in radians
    this._target   = 0;        // 0 = back facing camera, Math.PI = front facing
    this._flipping = false;
  }

  // ── Public: position / rotation helpers ─────────────────────────────────

  setPosition(x, y, z = 0) {
    this.group.position.set(x, y, z);
    return this;
  }

  setRotation(x, y, z) {
    this.group.rotation.set(x, y, z);
    return this;
  }

  // ── Public: flip ─────────────────────────────────────────────────────────

  /**
   * Trigger a 180° Y-axis flip to reveal (showFront = true) or hide the face.
   * The animation runs inside update() every frame — no setTimeout, no GSAP.
   *
   * If you prefer GSAP for tighter control:
   *   gsap.to(this.group.rotation, { y: Math.PI, duration: 0.4, ease: 'power2.inOut' });
   */
  flip(showFront = true) {
    this._target   = showFront ? Math.PI : 0;
    this._flipping = true;
  }

  get isFaceUp() {
    return this._target === Math.PI;
  }

  // ── Internal: called by CardScene every frame ─────────────────────────────

  /**
   * Exponential ease-out lerp: feels "physical" without a spring library.
   * Formula: value += (target - value) * (1 - e^(-k * dt))
   *   k = speed constant (higher = snappier)
   *   dt = seconds since last frame (frame-rate independent)
   */
  update(delta) {
    if (!this._flipping) return;

    const k    = 8; // radians/s² feel — tweak to taste
    const ease = 1 - Math.exp(-k * delta);
    this._angle = THREE.MathUtils.lerp(this._angle, this._target, ease);
    this.group.rotation.y = this._angle;

    // Snap to target when close enough to avoid infinite approach
    if (Math.abs(this._angle - this._target) < 0.002) {
      this._angle            = this._target;
      this.group.rotation.y  = this._target;
      this._flipping         = false;
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  /**
   * Dispose GPU resources owned by this card.
   * Do NOT call SHARED_GEOMETRY.dispose() here — other cards still use it.
   * Call CardScene.dispose() to clean up the geometry when the scene is gone.
   */
  dispose() {
    for (const mesh of [this.frontMesh, this.backMesh]) {
      // Only dispose textures the card created; caller-owned textures are their
      // responsibility (e.g. a shared backTexture used by 52 cards).
      mesh.material.dispose();
    }
  }
}

// ─── CardScene ────────────────────────────────────────────────────────────────
/**
 * Owns the WebGLRenderer, Scene, Camera, Lights and the render loop.
 * Manages a flat list of Card3D instances and routes pointer/touch events
 * to the correct card via Raycaster.
 */
export class CardScene {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this._cards    = [];
    this._meshPool = []; // flat array of meshes passed to Raycaster

    this._raycaster = new THREE.Raycaster();
    this._pointer   = new THREE.Vector2(-2, -2); // off-screen default
    this._clock     = new THREE.Clock();
    this._rafId     = null;

    /** @type {((card: Card3D) => void) | null} */
    this.onCardClick = null;

    /** @type {((card: Card3D | null) => void) | null} */
    this.onCardHover = null;

    this._initRenderer(canvas);
    this._initScene();
    this._initCamera();
    this._initLights();
    this._bindEvents();
    this._startLoop();
  }

  // ── Renderer ──────────────────────────────────────────────────────────────

  _initRenderer(canvas) {
    this._renderer = new THREE.WebGLRenderer({
      canvas,
      antialias:       false,       // biggest single GPU saving on mobile
      powerPreference: 'low-power', // hints browser/OS to use integrated GPU
      precision:       'mediump',   // 16-bit floats — more than enough for cards
      alpha:           false,       // opaque canvas = no per-pixel blending cost
    });

    // Cap pixel ratio at 2: beyond that the gain is invisible but cost doubles
    this._renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this._renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

    // Guideline 4: shadows disabled globally
    this._renderer.shadowMap.enabled = false;
  }

  // ── Scene / Camera / Lights ───────────────────────────────────────────────

  _initScene() {
    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(0x071626); // matches felt-center dark
  }

  _initCamera() {
    const el = this._renderer.domElement;
    this._camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.1, 50);
    this._camera.position.set(0, 0, 8);
    this._camera.lookAt(0, 0, 0);
  }

  _initLights() {
    // ── Ambient: fills shadows softly, zero cost ──────────────────────────
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this._scene.add(ambient);

    // ── Directional: one "sun" light coming from upper-right ──────────────
    // castShadow = false (default) — guideline 4
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(4, 8, 6);
    dir.castShadow = false; // explicit: never enable this on mobile
    this._scene.add(dir);

    // Optional: a faint cyan rim light to match the futuristic UI palette
    const rim = new THREE.DirectionalLight(0x00d4ff, 0.15);
    rim.position.set(-6, -2, 4);
    this._scene.add(rim);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Add a Card3D to the scene.
   * @param {Card3D}          card
   * @param {THREE.Vector3}   [position]
   */
  addCard(card, position) {
    if (position) card.group.position.copy(position);
    this._scene.add(card.group);
    this._cards.push(card);
    // Both face meshes enter the raycaster pool
    this._meshPool.push(card.frontMesh, card.backMesh);
    return this;
  }

  /**
   * Remove and dispose a Card3D from the scene.
   * @param {Card3D} card
   */
  removeCard(card) {
    this._scene.remove(card.group);
    this._cards    = this._cards.filter(c => c !== card);
    this._meshPool = this._meshPool.filter(m => m !== card.frontMesh && m !== card.backMesh);
    card.dispose();
    return this;
  }

  // ── Events ────────────────────────────────────────────────────────────────

  _bindEvents() {
    const el = this._renderer.domElement;

    // Use `pointer` events: unifies mouse + touch with one handler
    el.addEventListener('pointermove',  this._onPointerMove.bind(this));
    el.addEventListener('pointerdown',  this._onPointerDown.bind(this));
    el.addEventListener('pointerleave', () => {
      this._pointer.set(-2, -2);
      this.onCardHover?.(null);
    });

    // Handle canvas resize
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      this._camera.aspect = w / h;
      this._camera.updateProjectionMatrix();
      this._renderer.setSize(w, h, false);
    });
    ro.observe(el);
    this._resizeObserver = ro;
  }

  /** Convert a PointerEvent to Normalized Device Coordinates [-1, 1]. */
  _toNDC(event) {
    const rect = this._renderer.domElement.getBoundingClientRect();
    this._pointer.x =  ((event.clientX - rect.left) / rect.width)  * 2 - 1;
    this._pointer.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;
  }

  /**
   * Guideline 5: Raycaster — pick card under pointer.
   * Returns the Card3D or null.
   */
  _pick() {
    this._raycaster.setFromCamera(this._pointer, this._camera);
    const hits = this._raycaster.intersectObjects(this._meshPool);
    return hits.length > 0 ? hits[0].object.userData.card : null;
  }

  _onPointerMove(event) {
    this._toNDC(event);
    this.onCardHover?.(this._pick());
  }

  _onPointerDown(event) {
    this._toNDC(event);
    const card = this._pick();
    if (card) this.onCardClick?.(card);
  }

  // ── Render loop ───────────────────────────────────────────────────────────

  _startLoop() {
    const tick = () => {
      this._rafId = requestAnimationFrame(tick);
      const delta = this._clock.getDelta();
      for (const card of this._cards) card.update(delta);
      this._renderer.render(this._scene, this._camera);
    };
    tick();
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  /**
   * Call this when unmounting (React useEffect cleanup, page unload, etc.)
   * Disposes the shared geometry — only safe once ALL cards are removed.
   */
  dispose() {
    cancelAnimationFrame(this._rafId);
    this._resizeObserver?.disconnect();
    for (const card of this._cards) card.dispose();
    SHARED_GEOMETRY.dispose(); // shared geometry — dispose once here, not per-card
    this._renderer.dispose();
  }
}
