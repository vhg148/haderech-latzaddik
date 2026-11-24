import * as THREE from 'three';
import { LANES, PLAYER_CONFIG } from './config.js';
import { createSignTexture } from './world.js';

const texLoader = new THREE.TextureLoader();

function loadSpriteTex(url) {
  const tex = texLoader.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

export class PlayerController {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();

    // Load all 7 sliced character poses from the user's uploaded sprites!
    this.textures = {
      back_idle: loadSpriteTex('assets/sprites/back_idle.png'),
      back_run1: loadSpriteTex('assets/sprites/back_run1.png'),
      back_run2: loadSpriteTex('assets/sprites/back_run2.png'),
      side_run: loadSpriteTex('assets/sprites/side_run.png'),
      front_idle: loadSpriteTex('assets/sprites/front_idle.png'),
      front_wave: loadSpriteTex('assets/sprites/front_wave.png'),
      front_jump: loadSpriteTex('assets/sprites/front_jump.png'),
      front_helmet: loadSpriteTex('assets/sprites/front_helmet.png'),
    };

    // High-res character plane (aspect 300x360 = 0.833)
    this.charHeight = 2.65;
    this.charWidth = this.charHeight * (300 / 360);
    const charGeo = new THREE.PlaneGeometry(this.charWidth, this.charHeight);
    // Shift geometry up so pivot is right at the character's feet (y = 0)
    charGeo.translate(0, this.charHeight * 0.5, 0);

    this.charMat = new THREE.MeshBasicMaterial({
      map: this.textures.front_wave,
      transparent: true,
      alphaTest: 0.12,
      side: THREE.DoubleSide,
    });
    this.charMesh = new THREE.Mesh(charGeo, this.charMat);
    this.group.add(this.charMesh);

    // Crisp ground contact shadow
    const shadowGeo = new THREE.CircleGeometry(0.95, 24);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x050814,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.position.y = 0.04;
    this.scene.add(this.shadowMesh);

    // Visual Power-up attachments around character
    this._buildAuraAttachments();

    this.scene.add(this.group);

    // Physics state
    this.reset();
  }

  _buildAuraAttachments() {
    // 1. Fire Shield Aura ("האש שלי תוקד" - glowing orange/gold ring + sphere)
    this.fireShieldGroup = new THREE.Group();
    const shieldSphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.55, 20, 16),
      new THREE.MeshBasicMaterial({
        color: 0xff6b2b,
        transparent: true,
        opacity: 0.22,
        wireframe: false,
        depthWrite: false,
      })
    );
    shieldSphere.position.y = 1.3;
    const shieldRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.45, 0.09, 10, 28),
      new THREE.MeshBasicMaterial({ color: 0xffb703 })
    );
    shieldRing.position.y = 1.25;
    shieldRing.rotation.x = Math.PI * 0.42;

    // Floating iconic red firefighter helmet crest above head when running with Fire Shield!
    const helmetDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x991b1b, emissiveIntensity: 0.4, roughness: 0.25 })
    );
    helmetDome.position.set(0, 2.52, 0.08);
    const helmetBrim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.52, 0.07, 16),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 })
    );
    helmetBrim.position.set(0, 2.52, 0.08);
    const badge = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.14, 0),
      new THREE.MeshBasicMaterial({ color: 0xfde047 })
    );
    badge.position.set(0, 2.7, 0.46);

    this.fireShieldGroup.add(shieldSphere, shieldRing, helmetDome, helmetBrim, badge);
    this.fireShieldGroup.visible = false;
    this.group.add(this.fireShieldGroup);
    this.fireShieldRing = shieldRing;

    // 2. Wings of Joy (glowing golden light wings)
    this.wingsGroup = new THREE.Group();
    const wingMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.quadraticCurveTo(1.2, 0.8, 1.9, 1.35);
    wingShape.quadraticCurveTo(1.5, 0.35, 1.45, -0.35);
    wingShape.quadraticCurveTo(0.8, -0.5, 0, -0.2);
    const wingGeo = new THREE.ShapeGeometry(wingShape);

    this.leftWing = new THREE.Mesh(wingGeo, wingMat);
    this.leftWing.position.set(-0.35, 1.5, -0.15);
    this.leftWing.scale.x = -1;
    this.rightWing = new THREE.Mesh(wingGeo, wingMat);
    this.rightWing.position.set(0.35, 1.5, -0.15);
    this.wingsGroup.add(this.leftWing, this.rightWing);
    this.wingsGroup.visible = false;
    this.group.add(this.wingsGroup);

    // 3. Magnet Aura (cyan-gold spinning ring)
    this.magnetRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.55, 0.07, 10, 30),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.82 })
    );
    this.magnetRing.position.y = 1.2;
    this.magnetRing.rotation.x = Math.PI / 2;
    this.magnetRing.visible = false;
    this.group.add(this.magnetRing);

    // 4. Joy Fever Radiant Halo
    this.joyHalo = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.85, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffd24c,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.joyHalo.position.set(0, 1.4, -0.18);
    this.joyHalo.visible = false;
    this.group.add(this.joyHalo);
  }

  reset() {
    this.lane = 1; // 0 = left (-3.2), 1 = center (0), 2 = right (+3.2)
    this.x = LANES[1];
    this.y = 0;
    this.vy = 0;
    this.groundY = 0;
    this.isJumping = false;
    this.fastFalling = false;
    this.isSliding = false;
    this.queuedSlide = false;
    this.slideTimer = 0;
    this.jumpBufferTimer = 0;
    this.laneSwitchTimer = 0;
    this.laneSwitchDir = 0;
    this.runAnimTime = 0;
    this.squashY = 1;
    this.squashX = 1;
    this.invincibleTimer = 0;
    this.coyoteTimer = 0;

    this.group.position.set(0, 0, 0);
    this.charMesh.rotation.set(0, 0, 0);
    this.charMesh.scale.set(1, 1, 1);
  }

  moveLane(delta) {
    const next = Math.max(0, Math.min(2, this.lane + delta));
    if (next !== this.lane) {
      this.lane = next;
      this.laneSwitchDir = delta;
      this.laneSwitchTimer = 0.14;
      return true;
    }
    return false;
  }

  jump(hasWings) {
    if (!this.isJumping || this.coyoteTimer > 0) {
      this._executeJump(hasWings);
      return true;
    }
    // Buffer jump input for 160ms so pressing Jump right before landing always fires cleanly!
    this.jumpBufferTimer = 0.16;
    return false;
  }

  _executeJump(hasWings) {
    this.isJumping = true;
    this.fastFalling = false;
    this.isSliding = false;
    this.queuedSlide = false;
    this.slideTimer = 0;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.vy = hasWings ? PLAYER_CONFIG.superJumpVelocity : PLAYER_CONFIG.jumpVelocity;
    this.squashY = 1.18;
    this.squashX = 0.88;
  }

  slide() {
    if (this.isJumping) {
      // Crisp Subway Surfers fast-fall: slam down and start full slide on touchdown!
      this.fastFalling = true;
      this.queuedSlide = true;
      this.vy = Math.min(this.vy, -26);
      return true;
    }
    this.isSliding = true;
    this.slideTimer = PLAYER_CONFIG.slideDuration;
    this.squashY = 0.62;
    this.squashX = 1.2;
    return true;
  }

  getHitbox() {
    const h = this.isSliding ? PLAYER_CONFIG.slideHeight : PLAYER_CONFIG.baseHeight;
    return {
      x: this.x,
      y: this.y,
      z: 0,
      halfW: 0.62,
      height: h,
      halfD: 0.55,
    };
  }

  update(dt, speed, mode, powerups, timeNow) {
    // Mode: 'menu' | 'playing' | 'victory' | 'gameover'
    if (mode === 'menu') {
      this.charMat.map = this.textures.front_wave;
      this.group.position.set(0, Math.sin(timeNow * 3.2) * 0.12, 0);
      this.charMesh.rotation.z = Math.sin(timeNow * 2.2) * 0.04;
      this.charMesh.scale.set(1, 1, 1);
      this.shadowMesh.position.set(0, 0.04, 0);
      this.shadowMesh.scale.setScalar(1);
      this._updateAuras(dt, timeNow, { fire: 0, magnet: 0, wings: 0, joy: 0 });
      return;
    }

    if (mode === 'victory') {
      this.charMat.map = powerups.fire > 0 ? this.textures.front_helmet : this.textures.front_jump;
      const hop = Math.abs(Math.sin(timeNow * 5.5)) * 1.15;
      this.group.position.set(0, hop, 0);
      this.charMesh.rotation.z = Math.sin(timeNow * 5.5) * 0.08;
      this.charMesh.scale.set(1, 1, 1);
      this.shadowMesh.position.set(0, 0.04, 0);
      this.shadowMesh.scale.setScalar(Math.max(0.45, 1 - hop * 0.28));
      this._updateAuras(dt, timeNow, { fire: 0, magnet: 0, wings: 0, joy: 1 });
      return;
    }

    // Horizontal lane interpolation
    const targetX = LANES[this.lane];
    const prevX = this.x;
    this.x += (targetX - this.x) * Math.min(1, dt * PLAYER_CONFIG.laneLerpSpeed);
    const vx = (this.x - prevX) / Math.max(dt, 0.001);

    // Vertical physics (supports running on top of trains via dynamic groundY!)
    const prevY = this.y;
    let bufferedJumped = false;
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= dt;

    if (this.isJumping || this.y > this.groundY + 0.01) {
      const grav = this.fastFalling ? PLAYER_CONFIG.fastFallGravity : PLAYER_CONFIG.gravity;
      this.vy -= grav * dt;
      this.y += this.vy * dt;
      if (this.y <= this.groundY) {
        this.y = this.groundY;
        this.vy = 0;
        if (this.isJumping) {
          this.isJumping = false;
          this.fastFalling = false;
          if (this.queuedSlide) {
            this.queuedSlide = false;
            this.isSliding = true;
            this.slideTimer = PLAYER_CONFIG.slideDuration;
            this.squashY = 0.62;
            this.squashX = 1.2;
          } else if (this.jumpBufferTimer > 0) {
            this._executeJump(powerups.wings > 0);
            bufferedJumped = true;
          } else {
            this.squashY = 0.8;
            this.squashX = 1.16;
          }
        }
      }
    } else {
      this.y = this.groundY;
      this.coyoteTimer = 0.1;
      if (this.jumpBufferTimer > 0) {
        this._executeJump(powerups.wings > 0);
        bufferedJumped = true;
      }
    }

    if (this.y > this.groundY && this.coyoteTimer > 0) {
      this.coyoteTimer -= dt;
    }

    // Slide timer
    if (this.isSliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) {
        this.isSliding = false;
      }
    }

    if (this.laneSwitchTimer > 0) this.laneSwitchTimer -= dt;
    if (this.invincibleTimer > 0) this.invincibleTimer -= dt;

    // Smooth squash & stretch recovery
    const targetSY = this.isSliding ? 0.56 : 1.0;
    const targetSX = this.isSliding ? 1.2 : 1.0;
    this.squashY += (targetSY - this.squashY) * Math.min(1, dt * 15);
    this.squashX += (targetSX - this.squashX) * Math.min(1, dt * 15);

    // Consistent forward-facing back-run stride (no jarring side/front flicker mid-run!)
    this.runAnimTime += dt * (speed * 0.38);
    if (this.isJumping) {
      this.charMat.map = this.vy > 0 ? this.textures.back_run1 : this.textures.back_run2;
    } else {
      const frame = Math.floor(this.runAnimTime) % 2;
      this.charMat.map = frame === 0 ? this.textures.back_run1 : this.textures.back_run2;
    }

    // Running stride bobbing
    const strideBob = (!this.isJumping && !this.isSliding) ? Math.abs(Math.sin(this.runAnimTime * Math.PI)) * 0.14 : 0;

    this.group.position.set(this.x, this.y + strideBob, 0);
    this.charMesh.scale.set(this.squashX, this.squashY, 1);

    // Dynamic Subway Surfers banking tilt on lane switch
    const targetRoll = THREE.MathUtils.clamp(-vx * 0.012, -0.22, 0.22);
    this.charMesh.rotation.z += (targetRoll - this.charMesh.rotation.z) * Math.min(1, dt * 16);

    // Blink briefly during post-hit invincibility
    if (this.invincibleTimer > 0) {
      this.charMesh.visible = Math.floor(this.invincibleTimer * 16) % 2 === 0;
    } else {
      this.charMesh.visible = true;
    }

    // Ground shadow tracks player x and scales with height above groundY
    const heightAbove = Math.max(0, this.y - this.groundY);
    this.shadowMesh.position.set(this.x, this.groundY + 0.04, 0);
    const shadowScale = Math.max(0.35, 1 - heightAbove * 0.12);
    this.shadowMesh.scale.setScalar(shadowScale);

    this._updateAuras(dt, timeNow, powerups);
    return { landed: prevY > this.groundY + 0.2 && this.y <= this.groundY + 0.01, bufferedJumped };
  }

  _updateAuras(dt, t, powerups) {
    // Fire Shield
    this.fireShieldGroup.visible = powerups.fire > 0;
    if (powerups.fire > 0) {
      this.fireShieldRing.rotation.z += dt * 4.5;
      this.fireShieldRing.rotation.y += dt * 2.2;
    }

    // Wings of Joy
    this.wingsGroup.visible = powerups.wings > 0;
    if (powerups.wings > 0) {
      const flap = Math.sin(t * 11) * 0.45;
      this.leftWing.rotation.y = flap;
      this.rightWing.rotation.y = -flap;
    }

    // Magnet
    this.magnetRing.visible = powerups.magnet > 0;
    if (powerups.magnet > 0) {
      this.magnetRing.rotation.z += dt * 5;
      const s = 1 + Math.sin(t * 7) * 0.1;
      this.magnetRing.scale.setScalar(s);
    }

    // Joy Fever
    this.joyHalo.visible = powerups.joy > 0;
    if (powerups.joy > 0) {
      this.joyHalo.rotation.z -= dt * 3;
      const s = 1 + Math.sin(t * 10) * 0.12;
      this.joyHalo.scale.setScalar(s);
    }
  }
}

// The Pursuing Meni'ot ("המניעות") — sleek low dark swirling shadow storm trailing behind the runner's heels without ever blocking the camera!
export class MeniotPursuer {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();

    const darkCloudMat = new THREE.MeshStandardMaterial({
      color: 0x1e1038,
      emissive: 0x581c87,
      emissiveIntensity: 0.7,
      roughness: 0.85,
      transparent: true,
      opacity: 0.82,
    });
    const innerCoreMat = new THREE.MeshBasicMaterial({
      color: 0x9333ea,
      transparent: true,
      opacity: 0.65,
    });

    // Low, ground-hugging swirling shadow lobes so the player and track ahead stay 100% unobstructed!
    this.lobes = [];
    const offsets = [
      [0, 0.72, 0, 0.72],
      [-0.78, 0.58, 0.25, 0.56],
      [0.78, 0.58, 0.25, 0.56],
      [-0.45, 1.05, 0.15, 0.45],
      [0.45, 1.05, 0.15, 0.45],
    ];
    for (const [x, y, z, r] of offsets) {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), darkCloudMat);
      m.position.set(x, y, z);
      this.group.add(m);
      this.lobes.push({ mesh: m, base: new THREE.Vector3(x, y, z), phase: Math.random() * Math.PI * 2 });
    }

    // Swirling horizontal vortex ring along the ground
    this.vortexRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.08, 8, 24),
      innerCoreMat
    );
    this.vortexRing.rotation.x = Math.PI / 2;
    this.vortexRing.position.set(0, 0.35, 0);
    this.group.add(this.vortexRing);

    // Glowing crimson eyes peeking right behind the runner
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3b3b });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), eyeMat);
    leftEye.position.set(-0.34, 1.05, -0.55);
    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), eyeMat);
    rightEye.position.set(0.34, 1.05, -0.55);
    this.group.add(leftEye, rightEye);

    this.group.position.set(0, 0, 7.5);
    this.scene.add(this.group);
  }

  update(dt, timeNow, playerX, dangerLevel, visible) {
    this.group.visible = visible && dangerLevel > 0.25;
    if (!this.group.visible) return;

    this.group.position.x += (playerX - this.group.position.x) * Math.min(1, dt * 5.0);

    // Stay cleanly behind the runner (z = 2.4..5.2) and well below camera sightline (camera is at z = 8.6, y = 5.05)
    const targetZ = THREE.MathUtils.lerp(5.2, 2.35, dangerLevel);
    this.group.position.z += (targetZ - this.group.position.z) * Math.min(1, dt * 5.0);
    this.group.position.y = Math.sin(timeNow * 4.5) * 0.1;

    const scale = 0.72 + dangerLevel * 0.24;
    this.group.scale.setScalar(scale);

    this.vortexRing.rotation.z += dt * (3.5 + dangerLevel * 4.5);

    for (const l of this.lobes) {
      l.mesh.position.y = l.base.y + Math.sin(timeNow * 5 + l.phase) * 0.1;
      l.mesh.rotation.y += dt * 1.4;
    }
  }
}

// Cached shared materials & textures for obstacles and collectibles
const SHARED = {
  lowSignTex: null,
  highSignTex: null,
  meniahSignTex: null,
};

function ensureSharedTextures() {
  if (!SHARED.lowSignTex) {
    SHARED.lowSignTex = createSignTexture('מניעה! קפוץ ⬆️', '', '#991b1b', '#fbbf24', '#ffffff');
    SHARED.highSignTex = createSignTexture('⬇️ החלק מתחת! ⬇️', 'שער בידוק • נתב״ג', '#1e3a8a', '#38bdf8', '#fef08a');
    SHARED.meniahSignTex = createSignTexture('מניעה!', '', '#4c1d95', '#f43f5e', '#ffffff');
  }
}

export function createObstacleMesh(type) {
  ensureSharedTextures();
  const group = new THREE.Group();

  if (type === 'low') {
    // Jumpable red-gold barrier + stacked travel suitcases
    const postMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });
    const leftPost = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.35, 0.24), postMat);
    leftPost.position.set(-1.15, 0.68, 0);
    const rightPost = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.35, 0.24), postMat);
    rightPost.position.set(1.15, 0.68, 0);

    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(2.55, 0.82, 0.36),
      new THREE.MeshStandardMaterial({ map: SHARED.lowSignTex, roughness: 0.4 })
    );
    bar.position.set(0, 0.92, 0);
    bar.castShadow = true;

    // Small travel suitcase next to barrier for airport flavor
    const bag = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.95, 0.48),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35 })
    );
    bag.position.set(0.65, 0.48, 0.32);
    bag.rotation.y = 0.2;

    group.add(leftPost, rightPost, bar, bag);
    return {
      group,
      type,
      halfW: 1.2,
      minY: 0,
      maxY: 1.35,
      roofY: null,
      halfD: 0.6,
      length: 1.2,
    };
  }

  if (type === 'high') {
    // Overhead Airport Security Arch — SLIDE UNDER!
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.35 });
    const leftP = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.6, 0.32), poleMat);
    leftP.position.set(-1.32, 1.8, 0);
    const rightP = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.6, 0.32), poleMat);
    rightP.position.set(1.32, 1.8, 0);

    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(2.85, 1.45, 0.55),
      new THREE.MeshStandardMaterial({ map: SHARED.highSignTex, roughness: 0.35 })
    );
    beam.position.set(0, 2.35, 0);
    beam.castShadow = true;

    // Bright cyan edge light along bottom edge so slide clearance is super legible
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(2.86, 0.12, 0.6),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    strip.position.set(0, 1.62, 0);

    group.add(leftP, rightP, beam, strip);
    return {
      group,
      type,
      halfW: 1.3,
      minY: 1.48, // Clearance underneath for sliding!
      maxY: 3.65,
      roofY: null,
      halfD: 0.6,
      length: 1.2,
    };
  }

  if (type === 'meniah') {
    // Swirling dark violet Meni'ah vortex pillar!
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 1.05, 3.2, 10),
      new THREE.MeshStandardMaterial({
        color: 0x3b0764,
        emissive: 0x7e22ce,
        emissiveIntensity: 0.85,
        roughness: 0.6,
      })
    );
    core.position.y = 1.6;
    const ring1 = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.1, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0xf43f5e })
    );
    ring1.position.y = 1.3;
    ring1.rotation.x = Math.PI / 2;

    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.08, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0xc084fc })
    );
    ring2.position.y = 2.4;
    ring2.rotation.x = Math.PI / 2;

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 0.65),
      new THREE.MeshBasicMaterial({ map: SHARED.meniahSignTex, side: THREE.DoubleSide })
    );
    sign.position.set(0, 3.55, 0);

    group.add(core, ring1, ring2, sign);
    group.userData.spinRings = [ring1, ring2];
    return {
      group,
      type,
      halfW: 1.05,
      minY: 0,
      maxY: 3.4,
      roofY: null,
      halfD: 0.9,
      length: 1.8,
    };
  }

  // Train / Airport Express Shuttle (`train`, `ramp_train`, `moving_train`)
  const hasRamp = type === 'ramp_train';
  const isMoving = type === 'moving_train';
  const trainLen = isMoving ? 13.5 : 14.5;
  const roofY = 3.25;

  const bodyColor = isMoving ? 0x0284c7 : (hasRamp ? 0x1e40af : 0x334155);
  const accentColor = isMoving ? 0x38bdf8 : 0xf59e0b;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.65, roofY, trainLen),
    new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.35, roughness: 0.35 })
  );
  body.position.set(0, roofY * 0.5, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Roof deck with bright highlight strips so players see they can run on top!
  const roofDeck = new THREE.Mesh(
    new THREE.BoxGeometry(2.45, 0.14, trainLen - 0.3),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6 })
  );
  roofDeck.position.set(0, roofY + 0.07, 0);
  group.add(roofDeck);

  // Accent livery stripe along sides
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(2.72, 0.42, trainLen - 0.2),
    new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.2 })
  );
  stripe.position.set(0, 1.55, 0);
  group.add(stripe);

  // Front windshield facing player (+Z side)
  const windshield = new THREE.Mesh(
    new THREE.PlaneGeometry(2.15, 1.05),
    new THREE.MeshBasicMaterial({ color: 0x93c5fd })
  );
  windshield.position.set(0, 2.35, trainLen * 0.5 + 0.02);
  group.add(windshield);

  // Glowing headlights facing player (+Z side)
  const headMat = new THREE.MeshBasicMaterial({ color: isMoving ? 0xfef08a : 0xffedd5 });
  for (const hx of [-0.82, 0.82]) {
    const hl = new THREE.Mesh(new THREE.CircleGeometry(0.24, 12), headMat);
    hl.position.set(hx, 0.95, trainLen * 0.5 + 0.03);
    group.add(hl);
  }

  // Climbable bright yellow-gold boarding ramp on front (+Z side)!
  let rampLength = 0;
  if (hasRamp) {
    rampLength = 5.4;
    const rampShape = new THREE.Shape();
    rampShape.moveTo(0, 0);
    rampShape.lineTo(rampLength, 0);
    rampShape.lineTo(0, roofY);
    rampShape.closePath();

    const rampGeo = new THREE.ExtrudeGeometry(rampShape, { depth: 2.5, bevelEnabled: false });
    rampGeo.translate(0, 0, -1.25);
    // Rotate so slope faces +Z toward approaching player
    rampGeo.rotateY(-Math.PI / 2);

    const rampMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.3,
      roughness: 0.4,
    });
    const rampMesh = new THREE.Mesh(rampGeo, rampMat);
    rampMesh.position.set(0, 0, trainLen * 0.5);
    rampMesh.castShadow = true;
    rampMesh.receiveShadow = true;
    group.add(rampMesh);
  }

  return {
    group,
    type,
    halfW: 1.28,
    minY: 0,
    maxY: roofY,
    roofY,
    halfD: trainLen * 0.5,
    length: trainLen,
    hasRamp,
    rampLength,
    isMoving,
    moveSpeed: isMoving ? 7.5 : 0,
  };
}

// Glowing Golden "נקודה טובה" (Good Point from Torah 282!)
const goodPointGeo = new THREE.OctahedronGeometry(0.46, 0);
const superPointGeo = new THREE.OctahedronGeometry(0.72, 1);
const goodPointMat = new THREE.MeshStandardMaterial({
  color: 0xffd24c,
  emissive: 0xf59e0b,
  emissiveIntensity: 0.85,
  metalness: 0.65,
  roughness: 0.15,
});
const superPointMat = new THREE.MeshStandardMaterial({
  color: 0xfffbeb,
  emissive: 0xffd24c,
  emissiveIntensity: 1.1,
  metalness: 0.8,
  roughness: 0.1,
});
const haloGeo = new THREE.RingGeometry(0.55, 0.72, 18);
const haloMat = new THREE.MeshBasicMaterial({
  color: 0xfef08a,
  transparent: true,
  opacity: 0.55,
  side: THREE.DoubleSide,
});

export function createGoodPointMesh(isSuper = false) {
  const g = new THREE.Group();
  const gem = new THREE.Mesh(isSuper ? superPointGeo : goodPointGeo, isSuper ? superPointMat : goodPointMat);
  const halo = new THREE.Mesh(haloGeo, haloMat);
  if (isSuper) halo.scale.setScalar(1.45);
  g.add(gem, halo);
  return { group: g, gem, halo, isSuper };
}

const POWERUP_STYLES = {
  fire: { color: 0xff5722, ring: 0xfde047, label: '🔥 כובע האש' },
  magnet: { color: 0x0ea5e9, ring: 0xbae6fd, label: '🧲 מגנט אזמרה' },
  wings: { color: 0xeab308, ring: 0xfffbeb, label: '✨ כנפי שמחה' },
  double: { color: 0xa855f7, ring: 0xf5d0fe, label: '⚡ אור הצדיק ×2' },
};

export function createPowerupMesh(kind) {
  const style = POWERUP_STYLES[kind] || POWERUP_STYLES.fire;
  const g = new THREE.Group();

  const orb = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.68, 0),
    new THREE.MeshStandardMaterial({
      color: style.color,
      emissive: style.color,
      emissiveIntensity: 0.75,
      metalness: 0.5,
      roughness: 0.2,
    })
  );
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.08, 8, 22),
    new THREE.MeshBasicMaterial({ color: style.ring })
  );
  ring.rotation.x = Math.PI * 0.35;

  const tex = createSignTexture(style.label, '', '#0f172a', '#ffd24c', '#ffffff');
  const tag = new THREE.Mesh(
    new THREE.PlaneGeometry(2.15, 0.65),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
  );
  tag.position.set(0, 1.32, 0);

  g.add(orb, ring, tag);
  return { group: g, orb, ring, kind };
}

// Fast pooled 3D sparkle/explosion particle system
export class ParticleSystem {
  constructor(scene) {
    this.particles = [];
    this.scene = scene;
    this.geo = new THREE.OctahedronGeometry(0.16, 0);
  }

  burst(x, y, z, colorHex, count = 12, speed = 7) {
    const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 1 });
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.geo, mat.clone());
      m.position.set(x, y, z);
      const angle = Math.random() * Math.PI * 2;
      const up = 0.35 + Math.random() * 0.95;
      const spd = speed * (0.45 + Math.random() * 0.85);
      this.scene.add(m);
      this.particles.push({
        mesh: m,
        vx: Math.cos(angle) * spd,
        vy: up * spd,
        vz: Math.sin(angle) * spd,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.75,
      });
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= 18 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += dt * 7;
      p.mesh.rotation.y += dt * 7;
      const ratio = p.life / p.maxLife;
      p.mesh.scale.setScalar(Math.max(0.05, ratio * 1.2));
      p.mesh.material.opacity = Math.min(1, ratio * 1.3);
    }
  }

  clear() {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      p.mesh.material.dispose();
    }
    this.particles.length = 0;
  }
}
