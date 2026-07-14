/**
 * GameScene3D.js
 * Full Three.js scene for the FDP card game.
 * Called from GameBoard3D.tsx via syncState() on every game state change.
 */
import * as THREE from 'three';
import { getCardBack, getCardFace, disposeCardTextures } from './cardTextures.js';

// ─── Shared geometry (2 triangles, shared by every card mesh) ─────────────────
const CARD_W = 0.82;
const CARD_H = 1.15;
const CARD_GEOM = new THREE.PlaneGeometry(CARD_W, CARD_H);

// ─── Seat positions per player count (index 0 = human, clockwise) ─────────────
// Seats are pulled inward relative to table edge so they stay in camera frame.
const SEATS = {
  2: [
    { x: 0,    z: 2.8, fanAxis: 'x' },
    { x: 0,    z: -2.6, fanAxis: 'x' },
  ],
  3: [
    { x: 0,    z: 2.8,  fanAxis: 'x' },
    { x: 3.2,  z: -1.5, fanAxis: 'x' },
    { x: -3.2, z: -1.5, fanAxis: 'x' },
  ],
  4: [
    { x: 0,    z: 2.8,  fanAxis: 'x' },
    { x: 3.8,  z: 0.4,  fanAxis: 'z' },
    { x: 0,    z: -2.6, fanAxis: 'x' },
    { x: -3.8, z: 0.4,  fanAxis: 'z' },
  ],
  5: [
    { x: 0,    z: 2.8,  fanAxis: 'x' },
    { x: 3.5,  z: 1.5,  fanAxis: 'x' },
    { x: 2.4,  z: -2.2, fanAxis: 'x' },
    { x: -2.4, z: -2.2, fanAxis: 'x' },
    { x: -3.5, z: 1.5,  fanAxis: 'x' },
  ],
  6: [
    { x: 0,    z: 2.8,  fanAxis: 'x' },
    { x: 3.7,  z: 1.5,  fanAxis: 'x' },
    { x: 3.7,  z: -1.0, fanAxis: 'x' },
    { x: 0,    z: -2.6, fanAxis: 'x' },
    { x: -3.7, z: -1.0, fanAxis: 'x' },
    { x: -3.7, z: 1.5,  fanAxis: 'x' },
  ],
  7: [
    { x: 0,    z: 2.8,  fanAxis: 'x' },
    { x: 3.4,  z: 2.0,  fanAxis: 'x' },
    { x: 4.0,  z: -0.3, fanAxis: 'z' },
    { x: 2.0,  z: -2.5, fanAxis: 'x' },
    { x: -2.0, z: -2.5, fanAxis: 'x' },
    { x: -4.0, z: -0.3, fanAxis: 'z' },
    { x: -3.4, z: 2.0,  fanAxis: 'x' },
  ],
};

// ─── Card mesh ────────────────────────────────────────────────────────────────
class CardMesh {
  constructor(frontTex, backTex) {
    const frontMat = new THREE.MeshPhongMaterial({ map: frontTex, side: THREE.FrontSide,  shininess: 30 });
    const backMat  = new THREE.MeshPhongMaterial({ map: backTex,  side: THREE.BackSide,   shininess: 20 });
    this.front = new THREE.Mesh(CARD_GEOM, frontMat);
    this.back  = new THREE.Mesh(CARD_GEOM, backMat);
    this.group = new THREE.Group();
    this.group.add(this.front, this.back);

    // Lie flat on the table by default (XZ plane, normal pointing +Y)
    this.group.rotation.x = -Math.PI / 2;

    this._flipY    = 0;       // current Y rotation
    this._flipGoal = 0;       // target: 0 = back up, PI = face up
    this._animating = false;

    // Tag for raycaster
    this.front.userData.cardMesh = this;
    this.back.userData.cardMesh  = this;
  }

  setFaceUp(faceUp, instant = false) {
    // Cards lie flat (rotation.x = -π/2). Normal points +Y when rotation.y = 0,
    // so FrontSide is visible from above at y=0 (face up) and BackSide at y=π (face down).
    this._flipGoal = faceUp ? 0 : Math.PI;
    if (instant) {
      this._flipY = this._flipGoal;
      this.group.rotation.y = this._flipY;
      this._animating = false;
    } else {
      this._animating = true;
    }
  }

  update(dt) {
    if (!this._animating) return;
    this._flipY = THREE.MathUtils.lerp(this._flipY, this._flipGoal, 1 - Math.exp(-9 * dt));
    this.group.rotation.y = this._flipY;
    if (Math.abs(this._flipY - this._flipGoal) < 0.003) {
      this._flipY = this._flipGoal;
      this.group.rotation.y = this._flipGoal;
      this._animating = false;
    }
  }

  dispose() {
    this.front.material.dispose();
    this.back.material.dispose();
    // textures are owned by the cardTextures cache — don't dispose here
  }
}

// ─── GameScene3D ──────────────────────────────────────────────────────────────
export class GameScene3D {
  constructor(canvas) {
    this._canvas   = canvas;
    this._cards    = new Map(); // cardId → { mesh: CardMesh, ownerId: number }
    this._raycaster = new THREE.Raycaster();
    this._pointer   = new THREE.Vector2(-2, -2);
    this._timer     = new THREE.Timer();
    this._rafId     = null;
    this._humanId   = 0;
    this._prevState = null;

    /** Set from GameBoard3D: (cardId) => void */
    this.onCardClick = null;
    /** Whether clicking human's cards should fire onCardClick */
    this.canPlayCard = false;

    this._init();
  }

  // ── Setup ──────────────────────────────────────────────────────────────────
  _init() {
    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initLights();
    this._initTable();
    this._bindEvents();
    this._startLoop();
  }

  _initRenderer() {
    this._renderer = new THREE.WebGLRenderer({
      canvas:          this._canvas,
      antialias:       false,
      powerPreference: 'low-power',
      precision:       'mediump',
      alpha:           false,
    });
    this._renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this._renderer.shadowMap.enabled = false;
    this._resize();
  }

  _initScene() {
    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(0x030712);
    // Subtle tech-grid fog depth effect
    this._scene.fog = new THREE.Fog(0x030712, 18, 30);
  }

  _initCamera() {
    const { clientWidth: w, clientHeight: h } = this._canvas;
    const portrait = h > w;
    this._camera = new THREE.PerspectiveCamera(portrait ? 62 : 52, w / h, 0.1, 40);
    this._setCameraForAspect(w, h);
  }

  _setCameraForAspect(w, h) {
    const portrait = h > w;
    if (portrait) {
      this._camera.position.set(0, 9, 7);
      this._camera.fov = 62;
    } else {
      this._camera.position.set(0, 7, 7);
      this._camera.fov = 55;
    }
    this._camera.lookAt(0, 0, -0.5);
    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
  }

  _initLights() {
    // Guideline 4: ambient + single directional, castShadow = false
    this._scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(3, 8, 5);
    dir.castShadow = false;
    this._scene.add(dir);

    // Subtle cyan rim (matches UI palette)
    const rim = new THREE.DirectionalLight(0x00d4ff, 0.18);
    rim.position.set(-5, 2, -3);
    this._scene.add(rim);
  }

  _initTable() {
    // Oval felt: EllipseGeometry lying flat in XZ plane
    const feltGeo  = new THREE.CircleGeometry(1, 64);
    feltGeo.scale(5.2, 1, 3.6); // stretch into oval
    const feltMat  = new THREE.MeshPhongMaterial({ color: 0x071626, shininess: 5 });
    const felt     = new THREE.Mesh(feltGeo, feltMat);
    felt.rotation.x = -Math.PI / 2;
    felt.position.y  = -0.01;
    this._scene.add(felt);

    // Rail (outer glow ring) — slightly larger oval, dark metallic
    const railGeo  = new THREE.RingGeometry(0.97, 1.06, 64);
    railGeo.scale(5.35, 1, 3.75);
    const railMat  = new THREE.MeshPhongMaterial({
      color: 0x0a1520, shininess: 40,
      emissive: new THREE.Color(0x00d4ff), emissiveIntensity: 0.04,
    });
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.rotation.x = -Math.PI / 2;
    rail.position.y  = -0.005;
    this._scene.add(rail);

    // Grid plane (background floor)
    const floorGeo = new THREE.PlaneGeometry(30, 30, 20, 20);
    const floorMat = new THREE.MeshBasicMaterial({
      color: 0x00d4ff, transparent: true, opacity: 0.025,
      wireframe: true,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.1;
    this._scene.add(floor);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Called from React whenever gameState changes.
   * Idempotent — safe to call with same state, only does work on change.
   */
  syncState(state, humanId) {
    this._humanId   = humanId;
    this._prevState = state;

    const { players, currentTrick, vira, manilhaValue, trickWinnerId, phase, round } = state;

    const activePlayers = players.filter(p => !p.eliminated);
    const n = Math.min(activePlayers.length, 7);
    const seats = SEATS[n] ?? SEATS[4];

    // Map humanId to seat index 0
    const humanIdx = activePlayers.findIndex(p => p.id === humanId);

    // Track which card IDs are still "live" this tick
    const liveIds = new Set();

    // ── Vira card ───────────────────────────────────────────────────────────
    if (vira) {
      const viraId = `__vira__${vira.id}`;
      liveIds.add(viraId);
      if (!this._cards.has(viraId)) {
        const face = getCardFace(vira.suit, vira.value, { isManilha: false });
        const back = getCardBack();
        const mesh = new CardMesh(face, back);
        mesh.setFaceUp(true, true);
        // Right side of table, slightly toward back
        mesh.group.position.set(3.4, 0.02, -0.3);
        this._scene.add(mesh.group);
        this._cards.set(viraId, { mesh, ownerId: -1 });
      }
    }

    // ── Player hands ────────────────────────────────────────────────────────
    for (const player of activePlayers) {
      if (player.eliminated) continue;

      const relIdx = (activePlayers.indexOf(player) - humanIdx + n) % n;
      const seat   = seats[relIdx] ?? seats[0];
      const isHuman = player.id === humanId;

      // Human always sees their own cards; in round 1 all cards are dealt face-up
      const showFace = isHuman || round === 1;

      const hand = player.hand;
      const step = 0.82;
      const totalW = (hand.length - 1) * step;

      hand.forEach((card, i) => {
        liveIds.add(card.id);

        let mesh;
        if (this._cards.has(card.id)) {
          mesh = this._cards.get(card.id).mesh;
        } else {
          // New card — create and place
          const isManilha = card.value === manilhaValue;
          const face = showFace
            ? getCardFace(card.suit, card.value, { isManilha })
            : getCardFace(card.suit, card.value, { isManilha }); // create anyway for later reveal
          const back = getCardBack();
          mesh = new CardMesh(face, back);
          mesh.setFaceUp(showFace, true);
          this._scene.add(mesh.group);
          this._cards.set(card.id, { mesh, ownerId: player.id });
        }

        // Position in hand (spread along fan axis)
        let x = seat.x;
        let z = seat.z;
        if (seat.fanAxis === 'x') {
          x += -totalW / 2 + i * step;
        } else {
          z += -totalW / 2 + i * step;
        }

        mesh.group.position.set(x, 0.02, z);

        // Human's cards tilt slightly toward camera for better readability
        if (isHuman) {
          mesh.group.rotation.x = -Math.PI / 2 + 0.22;
        }

        // Sync face-up state (e.g. round changes)
        mesh.setFaceUp(showFace);

        // Clickable cards: slight hover-lift to distinguish
        const isClickable = this.canPlayCard && isHuman;
        mesh.group.position.y = isClickable ? 0.06 : 0.02;
      });
    }

    // ── Trick area cards ────────────────────────────────────────────────────
    currentTrick.forEach(({ playerId, card }, i) => {
      const trickId = `__trick__${card.id}`;
      liveIds.add(trickId);

      if (!this._cards.has(trickId)) {
        const isManilha = card.value === manilhaValue;
        const isWinning = phase === 'trick-end' && playerId === trickWinnerId;
        const face = getCardFace(card.suit, card.value, { isManilha, isWinning });
        const back = getCardBack();
        const mesh = new CardMesh(face, back);
        mesh.setFaceUp(true, true);
        this._scene.add(mesh.group);
        this._cards.set(trickId, { mesh, ownerId: playerId });
      } else if (phase === 'trick-end' && playerId === trickWinnerId) {
        // Regenerate face texture with winning highlight
        const entry = this._cards.get(trickId);
        const isManilha = card.value === manilhaValue;
        const face = getCardFace(card.suit, card.value, { isManilha, isWinning: true });
        entry.mesh.front.material.map = face;
        entry.mesh.front.material.needsUpdate = true;
      }

      // Place trick cards clustered at center, offset slightly toward the player who played them
      const playerIdx = activePlayers.findIndex(p => p.id === playerId);
      const relIdx    = playerIdx === -1 ? i : (playerIdx - humanIdx + n) % n;
      const seat      = seats[relIdx] ?? seats[0];
      const dist      = Math.sqrt(seat.x * seat.x + seat.z * seat.z) || 1;
      const SPREAD    = 0.38;
      const cx        = (seat.x / dist) * SPREAD;
      const cz        = (seat.z / dist) * SPREAD;

      const entry = this._cards.get(trickId);
      entry.mesh.group.position.set(cx, 0.03 + i * 0.004, cz);
      entry.mesh.group.rotation.y = 0;
    });

    // ── Remove stale cards ───────────────────────────────────────────────────
    for (const [id, { mesh }] of this._cards) {
      if (!liveIds.has(id)) {
        this._scene.remove(mesh.group);
        mesh.dispose();
        this._cards.delete(id);
      }
    }
  }

  /**
   * Projects 3D seat positions to 2D screen pixels.
   * Used by React to position player-info badges as CSS overlays.
   * Returns Map<playerId, {x, y, relIdx}>.
   */
  getSeatScreenPositions(activePlayers, humanId) {
    const result = new Map();
    const n = Math.min(activePlayers.length, 7);
    const seats = SEATS[n] ?? SEATS[4];
    const humanIdx = activePlayers.findIndex(p => p.id === humanId);

    for (const player of activePlayers) {
      const relIdx = (activePlayers.indexOf(player) - humanIdx + n) % n;
      const seat   = seats[relIdx] ?? seats[0];
      const world  = new THREE.Vector3(seat.x, 1.2, seat.z);
      const ndc    = world.clone().project(this._camera);
      const x = (ndc.x + 1) / 2 * this._canvas.clientWidth;
      const y = (-ndc.y + 1) / 2 * this._canvas.clientHeight;
      result.set(player.id, { x, y, relIdx });
    }
    return result;
  }

  // ── Events ────────────────────────────────────────────────────────────────
  _bindEvents() {
    const el = this._canvas;
    el.addEventListener('pointerdown', this._onPointer.bind(this));
    el.addEventListener('pointerleave', () => this._pointer.set(-2, -2));

    const ro = new ResizeObserver(this._resize.bind(this));
    ro.observe(el);
    this._ro = ro;
  }

  _toNDC(e) {
    const rect = this._canvas.getBoundingClientRect();
    this._pointer.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    this._pointer.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
  }

  _onPointer(e) {
    if (!this.onCardClick || !this.canPlayCard) return;
    this._toNDC(e);
    this._raycaster.setFromCamera(this._pointer, this._camera);

    // Only check human player's hand meshes
    const humanMeshes = [];
    for (const [, { mesh, ownerId }] of this._cards) {
      if (ownerId === this._humanId) humanMeshes.push(mesh.front, mesh.back);
    }

    const hits = this._raycaster.intersectObjects(humanMeshes);
    if (hits.length === 0) return;

    // Resolve which game card was hit
    const hitCardMesh = hits[0].object.userData.cardMesh;
    for (const [cardId, { mesh, ownerId }] of this._cards) {
      if (mesh === hitCardMesh && ownerId === this._humanId) {
        // Strip trick prefix if present (shouldn't happen here, but safe)
        if (!cardId.startsWith('__')) {
          this.onCardClick(cardId);
        }
        break;
      }
    }
  }

  _resize() {
    const w = this._canvas.clientWidth;
    const h = this._canvas.clientHeight;
    if (!w || !h) return;
    this._renderer.setSize(w, h, false);
    if (this._camera) this._setCameraForAspect(w, h);
  }

  // ── Render loop ───────────────────────────────────────────────────────────
  _startLoop() {
    const tick = () => {
      this._rafId = requestAnimationFrame(tick);
      this._timer.update();
      const dt = Math.min(this._timer.getDelta(), 0.05); // cap delta at 50ms
      for (const { mesh } of this._cards.values()) mesh.update(dt);
      this._renderer.render(this._scene, this._camera);
    };
    tick();
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  dispose() {
    cancelAnimationFrame(this._rafId);
    this._ro?.disconnect();
    for (const { mesh } of this._cards.values()) {
      this._scene.remove(mesh.group);
      mesh.dispose();
    }
    this._cards.clear();
    CARD_GEOM.dispose();
    disposeCardTextures();
    this._renderer.dispose();
  }
}
