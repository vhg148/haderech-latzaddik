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

// Create Lahav David's iconic white raglan shirt texture with navy "6" on chest!
function createLahavShirtTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle shoulder raglan curves
  ctx.fillStyle = '#b45309';
  ctx.fillRect(0, 0, 28, 72);
  ctx.fillRect(228, 0, 28, 72);

  // Bold navy "6" on chest
  ctx.fillStyle = '#1e3a5f';
  ctx.font = '900 132px Rubik, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('6', 128, 138);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Cute stylized face texture for 3D sibling avatars
function createCuteFaceTexture(isGirl = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Warm rosy kid skin tone
  ctx.fillStyle = '#f5c6a5';
  ctx.fillRect(0, 0, 256, 256);

  // Soft rosy cheeks
  ctx.fillStyle = 'rgba(244, 114, 114, 0.28)';
  ctx.beginPath();
  ctx.arc(76, 152, 22, 0, Math.PI * 2);
  ctx.arc(180, 152, 22, 0, Math.PI * 2);
  ctx.fill();

  // Expressive eyes
  for (const ex of [92, 164]) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, 122, 18, 19, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isGirl ? '#5b4b2a' : '#2c1810';
    ctx.beginPath();
    ctx.arc(ex, 123, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(ex, 123, 6.5, 0, Math.PI * 2);
    ctx.fill();

    // Pixar-style eye sparkle
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex - 4, 117, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Eyebrows
  ctx.strokeStyle = isGirl ? '#6b4c2e' : '#3b2416';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(74, 96);
  ctx.quadraticCurveTo(92, 88, 110, 95);
  ctx.moveTo(146, 95);
  ctx.quadraticCurveTo(164, 88, 182, 96);
  ctx.stroke();

  // Cute button nose
  ctx.fillStyle = '#e5a380';
  ctx.beginPath();
  ctx.arc(128, 146, 7, 0, Math.PI * 2);
  ctx.fill();

  // Big cheerful smile
  ctx.strokeStyle = '#9f3b3b';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(128, 156, 28, 0.18 * Math.PI, 0.82 * Math.PI);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Build articulated Pixar-inspired 3D character for Lahav David ("להב דויד")
function buildLahav3DModel() {
  const root = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5c6a5, roughness: 0.65 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.85 });
  const kippahMat = new THREE.MeshStandardMaterial({ color: 0xd9e8c5, roughness: 0.75 });
  const kippahTrimMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.8 });
  const sleeveMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.7 });
  const shirtWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 });
  const shirtFrontMat = new THREE.MeshStandardMaterial({ map: createLahavShirtTexture(), roughness: 0.7 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x4d5d43, roughness: 0.8 }); // Olive-green pants!
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
  const soleMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.8 });
  const tzitzitMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 });

  // Torso (white baseball raglan shirt with "6" on front!)
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 0.82, 0.46),
    [shirtWhiteMat, shirtWhiteMat, shirtWhiteMat, shirtWhiteMat, shirtFrontMat, shirtWhiteMat]
  );
  torso.position.y = 1.25;
  torso.castShadow = true;
  root.add(torso);

  // Fluttering white tzitzit strings at both hips
  const tzitzitParts = [];
  for (const side of [-1, 1]) {
    const tg = new THREE.Group();
    tg.position.set(side * 0.45, 0.92, 0);
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.015, 0.42, 6), tzitzitMat);
      s.position.set(0, -0.2, (i - 1) * 0.06);
      tg.add(s);
    }
    root.add(tg);
    tzitzitParts.push(tg);
  }

  // Head group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.98, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 18), skinMat);
  head.castShadow = true;
  headGroup.add(head);

  // Face plane subtly curved on +Z face side
  const facePlane = new THREE.Mesh(
    new THREE.CircleGeometry(0.35, 20),
    new THREE.MeshBasicMaterial({ map: createCuteFaceTexture(false) })
  );
  facePlane.position.set(0, -0.02, 0.36);
  headGroup.add(facePlane);

  // Short brown wavy hair cap + back hair
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.445, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairMat
  );
  hairCap.position.set(0, 0.03, -0.03);
  headGroup.add(hairCap);

  const hairBack = new THREE.Mesh(
    new THREE.SphereGeometry(0.435, 16, 12, Math.PI * 0.65, Math.PI * 1.7, Math.PI * 0.2, Math.PI * 0.62),
    hairMat
  );
  hairBack.position.set(0, -0.02, -0.04);
  headGroup.add(hairBack);

  // Light-green/off-white crocheted kippah with trim!
  const kippah = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.48),
    kippahMat
  );
  kippah.position.set(0, 0.34, -0.03);
  const kippahTrim = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.025, 8, 20), kippahTrimMat);
  kippahTrim.rotation.x = Math.PI / 2;
  kippahTrim.position.set(0, 0.36, -0.03);
  headGroup.add(kippah, kippahTrim);

  // Cute curly brown peyot (sidelocks)!
  const peyot = [];
  for (const side of [-1, 1]) {
    const pg = new THREE.Group();
    pg.position.set(side * 0.39, -0.05, 0.04);
    for (let k = 0; k < 5; k++) {
      const curl = new THREE.Mesh(new THREE.SphereGeometry(0.062 - k * 0.004, 8, 8), hairMat);
      curl.position.set(Math.sin(k * 1.4) * 0.022, -k * 0.08, Math.cos(k * 1.4) * 0.022);
      pg.add(curl);
    }
    headGroup.add(pg);
    peyot.push(pg);
  }
  root.add(headGroup);

  // Articulated Arms (caramel-brown raglan sleeves + forearms)
  const makeArm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.53, 1.56, 0);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.11, 0.34, 10), sleeveMat);
    sleeve.position.y = -0.15;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.32, 10), skinMat);
    arm.position.y = -0.44;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), skinMat);
    hand.position.y = -0.62;
    pivot.add(sleeve, arm, hand);
    root.add(pivot);
    return pivot;
  };
  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // Articulated Legs (olive-green pants + sporty sneakers)
  const makeLeg = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.22, 0.84, 0);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.125, 0.64, 10), pantsMat);
    leg.position.y = -0.32;
    leg.castShadow = true;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.17, 0.4), shoeMat);
    shoe.position.set(0, -0.71, 0.06);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 0.42), soleMat);
    sole.position.set(0, -0.8, 0.06);
    pivot.add(leg, shoe, sole);
    root.add(pivot);
    return pivot;
  };
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  return {
    root,
    parts: { headGroup, leftArm, rightArm, leftLeg, rightLeg, swayExtras: [...peyot, ...tzitzitParts] },
  };
}

// Build articulated Pixar-inspired 3D character for Yahav ("יהב")
function buildYahav3DModel() {
  const root = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf7cbb0, roughness: 0.65 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x8a6234, roughness: 0.78 }); // Golden-brown curls!
  const hairHighlightMat = new THREE.MeshStandardMaterial({ color: 0xa87c45, roughness: 0.75 });
  const hoodieMat = new THREE.MeshStandardMaterial({ color: 0x3b3135, roughness: 0.85 }); // Charcoal-brown cozy hoodie!
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x4c1d3d, roughness: 0.78 }); // Deep plum sporty pants!
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 }); // White side stripe!
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.55 });
  const gumSoleMat = new THREE.MeshStandardMaterial({ color: 0x9a6b3e, roughness: 0.8 });

  // Torso (cozy charcoal-brown hoodie + hood folded on back!)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.44), hoodieMat);
  torso.position.y = 1.22;
  torso.castShadow = true;
  root.add(torso);

  // Cute hoodie hood resting on upper back
  const hoodBack = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), hoodieMat);
  hoodBack.scale.set(1.25, 0.75, 0.7);
  hoodBack.position.set(0, 1.54, -0.22);
  root.add(hoodBack);

  // Head group with voluminous golden-brown long curly hair!
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.94, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 18), skinMat);
  head.castShadow = true;
  headGroup.add(head);

  const facePlane = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 20),
    new THREE.MeshBasicMaterial({ map: createCuteFaceTexture(true) })
  );
  facePlane.position.set(0, -0.02, 0.35);
  headGroup.add(facePlane);

  // Crown curly hair cap
  const hairCrown = new THREE.Mesh(
    new THREE.SphereGeometry(0.43, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.56),
    hairMat
  );
  hairCrown.position.set(0, 0.04, -0.02);
  headGroup.add(hairCrown);

  // Lush cascading golden-brown curls down back & both shoulders!
  const hairCurtain = new THREE.Group();
  hairCurtain.position.set(0, 0.05, -0.14);
  const curlCols = [
    [-0.36, 0.08, 4],
    [-0.22, -0.18, 5],
    [0, -0.24, 5],
    [0.22, -0.18, 5],
    [0.36, 0.08, 4],
  ];
  for (const [cx, cz, rows] of curlCols) {
    for (let r = 0; r < rows; r++) {
      const mat = (r % 2 === 0) ? hairMat : hairHighlightMat;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.145 - r * 0.008, 10, 10), mat);
      puff.position.set(cx + Math.sin(r * 1.5) * 0.03, -0.06 - r * 0.17, cz - r * 0.025);
      hairCurtain.add(puff);
    }
  }
  headGroup.add(hairCurtain);
  root.add(headGroup);

  // Articulated Arms (hoodie sleeves + hands)
  const makeArm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.49, 1.52, 0);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.1, 0.56, 10), hoodieMat);
    sleeve.position.y = -0.28;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 10), skinMat);
    hand.position.y = -0.6;
    pivot.add(sleeve, hand);
    root.add(pivot);
    return pivot;
  };
  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // Articulated Legs (deep plum sporty pants with crisp white side stripe + black/white/gum sneakers!)
  const makeLeg = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.2, 0.82, 0);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.118, 0.64, 10), pantsMat);
    leg.position.y = -0.32;
    leg.castShadow = true;
    const sideStripe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.62, 0.06), stripeMat);
    sideStripe.position.set(side * 0.13, -0.32, 0);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.38), shoeMat);
    shoe.position.set(0, -0.7, 0.06);
    const shoeStripe = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.04, 0.16), stripeMat);
    shoeStripe.position.set(0, -0.69, 0.06);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.055, 0.4), gumSoleMat);
    sole.position.set(0, -0.79, 0.06);
    pivot.add(leg, sideStripe, shoe, shoeStripe, sole);
    root.add(pivot);
    return pivot;
  };
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  return {
    root,
    parts: { headGroup, leftArm, rightArm, leftLeg, rightLeg, swayExtras: [hairCurtain] },
  };
}

export class PlayerController {
  constructor(scene, initialCharId = 'ari') {
    this.scene = scene;
    this.group = new THREE.Group();
    this.visualRoot = new THREE.Group();
    this.group.add(this.visualRoot);

    // 1. Ari Nachman high-res Pixar sprites
    this.textures = {
      back_idle: loadSpriteTex('assets/sprites/ari/back_idle.png'),
      back_run1: loadSpriteTex('assets/sprites/ari/back_run1.png'),
      back_run2: loadSpriteTex('assets/sprites/ari/back_run2.png'),
      front_wave: loadSpriteTex('assets/sprites/ari/front_wave.png'),
      front_jump: loadSpriteTex('assets/sprites/ari/front_jump.png'),
      front_helmet: loadSpriteTex('assets/sprites/ari/front_helmet.png'),
    };

    this.charHeight = 2.65;
    this.charWidth = this.charHeight * (300 / 360);
    const charGeo = new THREE.PlaneGeometry(this.charWidth, this.charHeight);
    charGeo.translate(0, this.charHeight * 0.5, 0);

    this.charMat = new THREE.MeshBasicMaterial({
      map: this.textures.front_wave,
      transparent: true,
      alphaTest: 0.12,
      side: THREE.DoubleSide,
    });
    this.spriteMesh = new THREE.Mesh(charGeo, this.charMat);
    this.visualRoot.add(this.spriteMesh);

    // 2. Articulated 3D models for Lahav David & Yahav
    this.models3D = {
      lahav: buildLahav3DModel(),
      yahav: buildYahav3DModel(),
    };
    this.models3D.lahav.root.scale.setScalar(1.06);
    this.models3D.yahav.root.scale.setScalar(1.03);
    this.models3D.lahav.root.visible = false;
    this.models3D.yahav.root.visible = false;
    this.visualRoot.add(this.models3D.lahav.root, this.models3D.yahav.root);

    // Ground contact shadow
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

    this._buildAuraAttachments();
    this.scene.add(this.group);

    this.characterId = 'ari';
    this.setCharacter(initialCharId);
    this.reset();
  }

  setCharacter(charId) {
    this.characterId = charId;
    this.spriteMesh.visible = charId === 'ari';
    this.models3D.lahav.root.visible = charId === 'lahav';
    this.models3D.yahav.root.visible = charId === 'yahav';
  }

  _buildAuraAttachments() {
    // 1. Fire Shield Aura ("כובע האש — האש שלי תוקד")
    this.fireShieldGroup = new THREE.Group();
    const shieldSphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.55, 20, 16),
      new THREE.MeshBasicMaterial({
        color: 0xff6b2b,
        transparent: true,
        opacity: 0.22,
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

    // 2. Wings of Joy
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

    // 3. Magnet Aura
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
    this.lane = 1;
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
    this.visualRoot.rotation.set(0, 0, 0);
    this.visualRoot.scale.set(1, 1, 1);
    this.visualRoot.visible = true;
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

  _animate3DModel(model, mode, timeNow, runPhase) {
    const { root, parts } = model;
    if (mode === 'menu') {
      root.rotation.y = 0; // Face camera!
      parts.leftLeg.rotation.x = 0;
      parts.rightLeg.rotation.x = 0;
      parts.leftArm.rotation.x = 0;
      parts.leftArm.rotation.z = 0.15;
      // Cheerful waving right arm!
      parts.rightArm.rotation.x = 0;
      parts.rightArm.rotation.z = -2.45 + Math.sin(timeNow * 7) * 0.35;
      parts.headGroup.rotation.z = Math.sin(timeNow * 2.5) * 0.06;
      return;
    }

    if (mode === 'victory') {
      root.rotation.y = 0; // Face camera jumping for joy!
      parts.leftArm.rotation.x = 0;
      parts.rightArm.rotation.x = 0;
      parts.leftArm.rotation.z = 2.65;
      parts.rightArm.rotation.z = -2.65;
      const tuck = Math.abs(Math.sin(timeNow * 5.5)) * 0.5;
      parts.leftLeg.rotation.x = tuck;
      parts.rightLeg.rotation.x = tuck;
      parts.headGroup.rotation.z = Math.sin(timeNow * 5.5) * 0.08;
      return;
    }

    // Playing: Face forward down the track (away from camera!)
    root.rotation.y = Math.PI;
    parts.leftArm.rotation.z = 0.14;
    parts.rightArm.rotation.z = -0.14;
    parts.headGroup.rotation.z = 0;

    if (this.isJumping) {
      parts.leftLeg.rotation.x = 0.55;
      parts.rightLeg.rotation.x = -0.45;
      parts.leftArm.rotation.x = -0.8;
      parts.rightArm.rotation.x = 0.6;
    } else if (this.isSliding) {
      parts.leftLeg.rotation.x = -0.8;
      parts.rightLeg.rotation.x = 0.4;
      parts.leftArm.rotation.x = 0.5;
      parts.rightArm.rotation.x = 0.5;
    } else {
      const swing = Math.sin(runPhase) * 0.92;
      parts.leftLeg.rotation.x = swing;
      parts.rightLeg.rotation.x = -swing;
      parts.leftArm.rotation.x = -swing * 0.85;
      parts.rightArm.rotation.x = swing * 0.85;
    }

    for (const extra of parts.swayExtras) {
      extra.rotation.x = 0.18 + Math.abs(Math.sin(runPhase)) * 0.16;
    }
  }

  update(dt, speed, mode, powerups, timeNow) {
    const active3D = this.models3D[this.characterId] || null;

    if (mode === 'menu') {
      this.visualRoot.visible = true;
      this.charMat.map = this.textures.front_wave;
      this.group.position.set(0, Math.sin(timeNow * 3.2) * 0.1, 0);
      this.visualRoot.rotation.z = Math.sin(timeNow * 2.2) * 0.035;
      this.visualRoot.scale.set(1, 1, 1);
      if (active3D) this._animate3DModel(active3D, 'menu', timeNow, 0);
      this.shadowMesh.position.set(0, 0.04, 0);
      this.shadowMesh.scale.setScalar(1);
      this._updateAuras(dt, timeNow, { fire: 0, magnet: 0, wings: 0, joy: 0 });
      return { landed: false, bufferedJumped: false };
    }

    if (mode === 'victory') {
      this.visualRoot.visible = true;
      this.charMat.map = powerups.fire > 0 ? this.textures.front_helmet : this.textures.front_jump;
      const hop = Math.abs(Math.sin(timeNow * 5.5)) * 1.1;
      this.group.position.set(0, hop, 0);
      this.visualRoot.rotation.z = Math.sin(timeNow * 5.5) * 0.07;
      this.visualRoot.scale.set(1, 1, 1);
      if (active3D) this._animate3DModel(active3D, 'victory', timeNow, 0);
      this.shadowMesh.position.set(0, 0.04, 0);
      this.shadowMesh.scale.setScalar(Math.max(0.45, 1 - hop * 0.28));
      this._updateAuras(dt, timeNow, { fire: 0, magnet: 0, wings: 0, joy: 1 });
      return { landed: false, bufferedJumped: false };
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

    if (this.isSliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) this.isSliding = false;
    }

    if (this.laneSwitchTimer > 0) this.laneSwitchTimer -= dt;
    if (this.invincibleTimer > 0) this.invincibleTimer -= dt;

    const targetSY = this.isSliding ? 0.56 : 1.0;
    const targetSX = this.isSliding ? 1.2 : 1.0;
    this.squashY += (targetSY - this.squashY) * Math.min(1, dt * 15);
    this.squashX += (targetSX - this.squashX) * Math.min(1, dt * 15);

    // Stride animation
    this.runAnimTime += dt * (speed * 0.42);
    if (active3D) {
      this._animate3DModel(active3D, 'playing', timeNow, this.runAnimTime * 1.45);
    } else {
      if (this.isJumping) {
        this.charMat.map = this.vy > 0 ? this.textures.back_run1 : this.textures.back_run2;
      } else {
        const frame = Math.floor(this.runAnimTime) % 2;
        this.charMat.map = frame === 0 ? this.textures.back_run1 : this.textures.back_run2;
      }
    }

    const strideBob = (!this.isJumping && !this.isSliding) ? Math.abs(Math.sin(this.runAnimTime * Math.PI)) * 0.14 : 0;

    this.group.position.set(this.x, this.y + strideBob, 0);
    this.visualRoot.scale.set(this.squashX, this.squashY, 1);

    const targetRoll = THREE.MathUtils.clamp(-vx * 0.012, -0.22, 0.22);
    this.visualRoot.rotation.z += (targetRoll - this.visualRoot.rotation.z) * Math.min(1, dt * 16);

    // Blink briefly during post-hit invincibility
    if (this.invincibleTimer > 0) {
      this.visualRoot.visible = Math.floor(this.invincibleTimer * 16) % 2 === 0;
    } else {
      this.visualRoot.visible = true;
    }

    const heightAbove = Math.max(0, this.y - this.groundY);
    this.shadowMesh.position.set(this.x, this.groundY + 0.04, 0);
    const shadowScale = Math.max(0.35, 1 - heightAbove * 0.12);
    this.shadowMesh.scale.setScalar(shadowScale);

    this._updateAuras(dt, timeNow, powerups);
    return { landed: prevY > this.groundY + 0.2 && this.y <= this.groundY + 0.01, bufferedJumped };
  }

  _updateAuras(dt, t, powerups) {
    this.fireShieldGroup.visible = powerups.fire > 0;
    if (powerups.fire > 0) {
      this.fireShieldRing.rotation.z += dt * 4.5;
      this.fireShieldRing.rotation.y += dt * 2.2;
    }

    this.wingsGroup.visible = powerups.wings > 0;
    if (powerups.wings > 0) {
      const flap = Math.sin(t * 11) * 0.45;
      this.leftWing.rotation.y = flap;
      this.rightWing.rotation.y = -flap;
    }

    this.magnetRing.visible = powerups.magnet > 0;
    if (powerups.magnet > 0) {
      this.magnetRing.rotation.z += dt * 5;
      this.magnetRing.scale.setScalar(1 + Math.sin(t * 7) * 0.1);
    }

    this.joyHalo.visible = powerups.joy > 0;
    if (powerups.joy > 0) {
      this.joyHalo.rotation.z -= dt * 3;
      this.joyHalo.scale.setScalar(1 + Math.sin(t * 10) * 0.12);
    }
  }
}

// The Pursuing Meni'ot ("המניעות") — visibly escalates across 0 -> 1 -> 2 -> 3 strikes without ever blocking the camera sightline!
export class MeniotPursuer {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();

    this.darkCloudMat = new THREE.MeshStandardMaterial({
      color: 0x1e1038,
      emissive: 0x581c87,
      emissiveIntensity: 0.75,
      roughness: 0.85,
      transparent: true,
      opacity: 0.84,
    });
    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.72,
    });

    this.lobes = [];
    const offsets = [
      [0, 0.7, 0, 0.72],
      [-0.82, 0.56, 0.25, 0.56],
      [0.82, 0.56, 0.25, 0.56],
      [-0.48, 1.02, 0.15, 0.44],
      [0.48, 1.02, 0.15, 0.44],
    ];
    for (const [x, y, z, r] of offsets) {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), this.darkCloudMat);
      m.position.set(x, y, z);
      this.group.add(m);
      this.lobes.push({ mesh: m, base: new THREE.Vector3(x, y, z), phase: Math.random() * Math.PI * 2 });
    }

    this.vortexRing = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.085, 8, 24), this.ringMat);
    this.vortexRing.rotation.x = Math.PI / 2;
    this.vortexRing.position.set(0, 0.35, 0);
    this.group.add(this.vortexRing);

    // Glowing red eyes glaring at the runner!
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2d2d });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), eyeMat);
    leftEye.position.set(-0.34, 1.05, -0.58);
    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), eyeMat);
    rightEye.position.set(0.34, 1.05, -0.58);
    this.group.add(leftEye, rightEye);

    this.group.position.set(0, 0, 7.5);
    this.scene.add(this.group);
  }

  // strikes: 0 (far lurking), 1 (noticeably closer & glowing), 2 (right on heels, crimson rage!), 3 (caught!)
  update(dt, timeNow, playerX, strikes, joyActive, visible) {
    this.group.visible = visible && (!joyActive || strikes >= 3);
    if (!this.group.visible) return;

    this.group.position.x += (playerX - this.group.position.x) * Math.min(1, dt * (4.2 + strikes * 1.4));

    const zByStrike = [4.9, 2.95, 1.85, 0.55];
    const scaleByStrike = [0.65, 0.88, 1.08, 1.25];
    const targetZ = zByStrike[Math.min(3, strikes)];
    const targetScale = scaleByStrike[Math.min(3, strikes)];

    this.group.position.z += (targetZ - this.group.position.z) * Math.min(1, dt * 5.2);
    this.group.position.y = Math.sin(timeNow * (4 + strikes * 1.5)) * 0.1;

    const s = this.group.scale.x + (targetScale - this.group.scale.x) * Math.min(1, dt * 5);
    this.group.scale.setScalar(s);

    // Shift emissive glow hotter & redder on Strike 2!
    if (strikes >= 2) {
      this.darkCloudMat.emissive.setHex(0x991b1b);
      this.ringMat.color.setHex(0xef4444);
    } else if (strikes === 1) {
      this.darkCloudMat.emissive.setHex(0x7e22ce);
      this.ringMat.color.setHex(0xc084fc);
    } else {
      this.darkCloudMat.emissive.setHex(0x4c1d95);
      this.ringMat.color.setHex(0x9333ea);
    }

    this.vortexRing.rotation.z += dt * (3.0 + strikes * 2.8);
    for (const l of this.lobes) {
      l.mesh.position.y = l.base.y + Math.sin(timeNow * (4.5 + strikes) + l.phase) * 0.11;
      l.mesh.rotation.y += dt * (1.2 + strikes * 0.6);
    }
  }
}

// Cached shared textures for obstacles
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
      minY: 1.48,
      maxY: 3.65,
      roofY: null,
      halfD: 0.6,
      length: 1.2,
    };
  }

  if (type === 'meniah') {
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

  const roofDeck = new THREE.Mesh(
    new THREE.BoxGeometry(2.45, 0.14, trainLen - 0.3),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6 })
  );
  roofDeck.position.set(0, roofY + 0.07, 0);
  group.add(roofDeck);

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(2.72, 0.42, trainLen - 0.2),
    new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.2 })
  );
  stripe.position.set(0, 1.55, 0);
  group.add(stripe);

  const windshield = new THREE.Mesh(
    new THREE.PlaneGeometry(2.15, 1.05),
    new THREE.MeshBasicMaterial({ color: 0x93c5fd })
  );
  windshield.position.set(0, 2.35, trainLen * 0.5 + 0.02);
  group.add(windshield);

  const headMat = new THREE.MeshBasicMaterial({ color: isMoving ? 0xfef08a : 0xffedd5 });
  for (const hx of [-0.82, 0.82]) {
    const hl = new THREE.Mesh(new THREE.CircleGeometry(0.24, 12), headMat);
    hl.position.set(hx, 0.95, trainLen * 0.5 + 0.03);
    group.add(hl);
  }

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

// Glowing Golden "נקודה טובה"
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
