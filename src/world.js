import * as THREE from 'three';
import { LANES, ZONES } from './config.js';

export function createSignTexture(text, subtext = '', bg = '#1e1b4b', accent = '#ffd24c', textColor = '#ffffff') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');

  // Background rounded panel
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Glowing border
  ctx.strokeStyle = accent;
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';

  ctx.fillStyle = textColor;
  ctx.font = 'bold 46px Rubik, Arial, sans-serif';
  ctx.fillText(text, canvas.width / 2, subtext ? 62 : 82);

  if (subtext) {
    ctx.fillStyle = accent;
    ctx.font = 'bold 28px Rubik, Arial, sans-serif';
    ctx.fillText(subtext, canvas.width / 2, 114);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createRoadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Rich dark slate asphalt/stone base
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, '#2a2f45');
  grad.addColorStop(0.5, '#333a54');
  grad.addColorStop(1, '#2a2f45');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle horizontal paving bands
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (let y = 0; y < 512; y += 32) {
    ctx.fillRect(0, y, 512, 4);
  }

  // Side glowing golden trim lines
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(10, 0, 10, 512);
  ctx.fillRect(492, 0, 10, 512);

  // Dashed lane separators (3 lanes -> dividers at 1/3 and 2/3)
  ctx.fillStyle = 'rgba(255, 224, 130, 0.78)';
  for (const x of [170, 341]) {
    for (let y = 16; y < 512; y += 64) {
      ctx.fillRect(x - 4, y, 8, 34);
    }
  }

  // Subtle track rail sheen inside each lane
  ctx.fillStyle = 'rgba(186, 230, 253, 0.14)';
  for (const cx of [88, 256, 424]) {
    ctx.fillRect(cx - 26, 0, 5, 512);
    ctx.fillRect(cx + 21, 0, 5, 512);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class WorldManager {
  constructor(scene) {
    this.scene = scene;
    this.chunks = [];
    this.chunkLength = 24;
    this.numChunks = 9;
    this.currentZoneIdx = 0;

    // Sky & lighting references
    this.ambientLight = null;
    this.sunLight = null;
    this.skyMat = null;
    this.sunMesh = null;
    this.stars = null;
    this.cloudsGroup = new THREE.Group();

    // Shared materials & textures
    this.roadTex = createRoadTexture();
    this.bridgeSignTex = createSignTexture('גשר צר מאד', 'והעיקר לא לפחד כלל ✦ ×2', '#2e1065', '#ffd24c', '#fffbeb');
    this.airportSignTex = createSignTexture('טיסה לאומן ✈️ שער רפ״ב', 'BOARDING NOW • נתב״ג -> אומן', '#0c4a6e', '#38bdf8', '#ffffff');
    this.jerusalemSignTex = createSignTexture('הדרך לצדיק', 'אוספים נקודות טובות • תורה רפ״ב', '#78350f', '#fde047', '#fffbeb');

    // Finish Airplane Gate group (placed at end of flight distance)
    this.finishGroup = null;
    this.finishActive = false;

    this._setupSkyAndLights();
    this._initChunks();
    this._buildFinishAirplane();
  }

  _setupSkyAndLights() {
    this.scene.fog = new THREE.Fog(ZONES[0].fogColor, ZONES[0].fogNear, ZONES[0].fogFar);

    this.ambientLight = new THREE.HemisphereLight(0xfff4d6, 0x26294a, 1.05);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xffcf77, 1.65);
    this.sunLight.position.set(18, 34, 16);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 110;
    this.sunLight.shadow.camera.left = -24;
    this.sunLight.shadow.camera.right = 24;
    this.sunLight.shadow.camera.top = 28;
    this.sunLight.shadow.camera.bottom = -28;
    this.scene.add(this.sunLight);

    // Gradient sky dome via shader
    const skyGeo = new THREE.SphereGeometry(220, 24, 16);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(ZONES[0].skyTop) },
        bottomColor: { value: new THREE.Color(ZONES[0].skyBottom) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPos;
        void main() {
          float h = clamp(normalize(vWorldPos).y * 1.45 + 0.15, 0.0, 1.0);
          vec3 col = mix(bottomColor, topColor, pow(h, 0.72));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(skyGeo, this.skyMat);
    this.scene.add(sky);

    // Glowing Sun / Moon orb on horizon
    const sunGeo = new THREE.SphereGeometry(11, 24, 24);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffe599, fog: false });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.sunMesh.position.set(0, 32, -165);
    this.scene.add(this.sunMesh);

    // Soft halo around sun
    const haloGeo = new THREE.RingGeometry(11.5, 22, 32);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xffd24c,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      fog: false,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    this.sunMesh.add(halo);

    // Twinkling stars (become brighter in Bridge & Airport night zones)
    const starPositions = [];
    for (let i = 0; i < 240; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.45;
      const r = 175;
      starPositions.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi) + 12,
        r * Math.sin(phi) * Math.sin(theta) - 30
      );
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    this.starMat = new THREE.PointsMaterial({
      color: 0xfff8dc,
      size: 1.5,
      transparent: true,
      opacity: 0.25,
      fog: false,
    });
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.scene.add(this.stars);

    // Fluffy stylized clouds floating high
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xfff7ed,
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: 0.65,
    });
    for (let i = 0; i < 14; i++) {
      const cg = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(3.2 + Math.random() * 2.2, 10, 10), cloudMat);
        puff.position.set((j - 1) * 3.2, Math.random() * 1.2, Math.random() * 1.4);
        puff.scale.y = 0.58;
        cg.add(puff);
      }
      cg.position.set(
        (Math.random() - 0.5) * 140,
        24 + Math.random() * 22,
        -25 - Math.random() * 140
      );
      this.cloudsGroup.add(cg);
    }
    this.scene.add(this.cloudsGroup);
  }

  _initChunks() {
    for (let i = 0; i < this.numChunks; i++) {
      const chunk = this._createChunk(i);
      chunk.group.position.z = 16 - i * this.chunkLength;
      this.scene.add(chunk.group);
      this.chunks.push(chunk);
    }
  }

  _createChunk(index) {
    const group = new THREE.Group();
    const L = this.chunkLength;

    // Main 3-lane track deck
    const roadGeo = new THREE.PlaneGeometry(11.4, L);
    const roadMat = new THREE.MeshStandardMaterial({
      map: this.roadTex,
      roughness: 0.78,
      metalness: 0.12,
    });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.receiveShadow = true;
    group.add(road);

    // Raised glowing golden/steel curbs on both sides of the track
    const curbGeo = new THREE.BoxGeometry(0.55, 0.55, L);
    const curbMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: 0x78350f,
      emissiveIntensity: 0.35,
      roughness: 0.4,
      metalness: 0.5,
    });
    const leftCurb = new THREE.Mesh(curbGeo, curbMat);
    leftCurb.position.set(-5.95, 0.25, 0);
    const rightCurb = new THREE.Mesh(curbGeo, curbMat);
    rightCurb.position.set(5.95, 0.25, 0);
    group.add(leftCurb, rightCurb);

    // Three themed scenery containers toggled seamlessly by current zone!
    const jerusalemProps = this._buildJerusalemProps(L, index);
    const bridgeProps = this._buildBridgeProps(L, index);
    const airportProps = this._buildAirportProps(L, index);

    bridgeProps.visible = false;
    airportProps.visible = false;

    group.add(jerusalemProps, bridgeProps, airportProps);

    return {
      group,
      roadMat,
      curbMat,
      jerusalemProps,
      bridgeProps,
      airportProps,
      zoneApplied: 'jerusalem',
    };
  }

  _buildJerusalemProps(L, idx) {
    const g = new THREE.Group();

    // Warm stone sidewalks & ground plane
    const sideMat = new THREE.MeshStandardMaterial({ color: 0xd6b588, roughness: 0.9 });
    const leftGround = new THREE.Mesh(new THREE.PlaneGeometry(46, L), sideMat);
    leftGround.rotation.x = -Math.PI / 2;
    leftGround.position.set(-29, -0.05, 0);
    leftGround.receiveShadow = true;
    const rightGround = new THREE.Mesh(new THREE.PlaneGeometry(46, L), sideMat);
    rightGround.rotation.x = -Math.PI / 2;
    rightGround.position.set(29, -0.05, 0);
    rightGround.receiveShadow = true;
    g.add(leftGround, rightGround);

    const stoneColors = [0xf2dfb8, 0xe8cfa0, 0xebd7b2, 0xdec08d];
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffe48f });
    const domeMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.65 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.85 });

    // Buildings on both sides
    for (const side of [-1, 1]) {
      for (let b = 0; b < 2; b++) {
        const w = 7.5 + ((idx + b) % 3) * 1.4;
        const h = 9 + ((idx * 3 + b * 5 + (side > 0 ? 2 : 0)) % 4) * 3.2;
        const d = 10.5;
        const bMat = new THREE.MeshStandardMaterial({
          color: stoneColors[(idx + b + (side > 0 ? 1 : 0)) % stoneColors.length],
          roughness: 0.85,
        });
        const bldg = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bMat);
        bldg.position.set(side * (10.6 + w * 0.5), h * 0.5, (b === 0 ? -L * 0.25 : L * 0.25));
        bldg.castShadow = true;
        bldg.receiveShadow = true;
        g.add(bldg);

        // Warm arched glowing windows facing road
        for (let wy = 2.6; wy < h - 1.5; wy += 3.1) {
          for (const wz of [-2.4, 2.4]) {
            const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.55), winMat);
            win.position.set(
              bldg.position.x - side * (w * 0.5 + 0.04),
              wy,
              bldg.position.z + wz
            );
            win.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
            g.add(win);
          }
        }

        // Occasional golden Jerusalem dome on roof
        if ((idx + b) % 3 === 0) {
          const dome = new THREE.Mesh(new THREE.SphereGeometry(2.4, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), domeMat);
          dome.position.set(bldg.position.x, h, bldg.position.z);
          g.add(dome);
        }
      }

      // Warm street lamp + olive tree near sidewalk
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.14, 5.8, 8),
        new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6 })
      );
      pole.position.set(side * 6.9, 2.9, 0);
      g.add(pole);

      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xfff3b0 })
      );
      lamp.position.set(side * 6.45, 5.9, 0);
      g.add(lamp);

      // Stylized cypress / olive tree
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 2.0, 7), trunkMat);
      trunk.position.set(side * 7.8, 1.0, L * 0.35);
      const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5, 0), leafMat);
      foliage.position.set(side * 7.8, 2.7, L * 0.35);
      foliage.scale.set(0.95, 1.25, 0.95);
      g.add(trunk, foliage);
    }

    // Periodic welcoming Jerusalem overhead banner
    if (idx % 4 === 1) {
      g.add(this._createOverheadBanner(this.jerusalemSignTex, 0xf59e0b));
    }

    return g;
  }

  _buildBridgeProps(L, idx) {
    const g = new THREE.Group();

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd24c,
      emissive: 0xd97706,
      emissiveIntensity: 0.45,
      metalness: 0.72,
      roughness: 0.25,
    });
    const railGlowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    // Glowing golden bridge railings & suspension cables over abyss of clouds
    for (const side of [-1, 1]) {
      const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, L), goldMat);
      topRail.position.set(side * 6.05, 1.85, 0);
      g.add(topRail);

      for (let z = -L * 0.38; z <= L * 0.38; z += L * 0.25) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 2.0, 8), goldMat);
        post.position.set(side * 6.05, 0.95, z);
        g.add(post);

        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), railGlowMat);
        orb.position.set(side * 6.05, 2.05, z);
        g.add(orb);
      }

      // Tall golden suspension tower on alternate chunks
      if (idx % 2 === 0) {
        const tower = new THREE.Mesh(new THREE.BoxGeometry(0.85, 15, 0.85), goldMat);
        tower.position.set(side * 6.5, 7.2, 0);
        g.add(tower);
      }
    }

    // Floating luminous clouds far below the Narrow Bridge
    const lowCloudMat = new THREE.MeshBasicMaterial({
      color: 0x6d28d9,
      transparent: true,
      opacity: 0.35,
    });
    for (const side of [-1, 1]) {
      const cloud = new THREE.Mesh(new THREE.SphereGeometry(7.5, 10, 8), lowCloudMat);
      cloud.scale.set(1.5, 0.35, 1.5);
      cloud.position.set(side * 16, -6.5, (idx % 2 === 0 ? -4 : 4));
      g.add(cloud);
    }

    // Overhead Narrow Bridge arch with Rabbi Nachman's famous quote
    if (idx % 3 === 0) {
      g.add(this._createOverheadBanner(this.bridgeSignTex, 0xffd24c));
    }

    return g;
  }

  _buildAirportProps(L, idx) {
    const g = new THREE.Group();

    // Tarmac runway shoulders
    const tarmacMat = new THREE.MeshStandardMaterial({ color: 0x162038, roughness: 0.85 });
    const leftTarmac = new THREE.Mesh(new THREE.PlaneGeometry(54, L), tarmacMat);
    leftTarmac.rotation.x = -Math.PI / 2;
    leftTarmac.position.set(-33, -0.05, 0);
    const rightTarmac = new THREE.Mesh(new THREE.PlaneGeometry(54, L), tarmacMat);
    rightTarmac.rotation.x = -Math.PI / 2;
    rightTarmac.position.set(33, -0.05, 0);
    g.add(leftTarmac, rightTarmac);

    // Glowing blue & amber runway edge beacons
    const blueBeacon = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const amberBeacon = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    for (const side of [-1, 1]) {
      for (let z = -L * 0.4; z <= L * 0.4; z += 6) {
        const b = new THREE.Mesh(
          new THREE.SphereGeometry(0.28, 8, 8),
          (Math.abs(z) < 4 ? amberBeacon : blueBeacon)
        );
        b.position.set(side * 6.65, 0.35, z);
        g.add(b);
      }

      // Sleek modern glass airport terminal concourse on outer side
      const terminal = new THREE.Mesh(
        new THREE.BoxGeometry(10, 11.5, L - 2),
        new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          metalness: 0.45,
          roughness: 0.3,
        })
      );
      terminal.position.set(side * 19, 5.75, 0);
      g.add(terminal);

      // Bright cyan glass window strip
      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(L - 4, 4.8),
        new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.72 })
      );
      glass.position.set(side * 13.9, 6.2, 0);
      glass.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      g.add(glass);

      // Runway floodlight pole
      if (idx % 2 === 1) {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.18, 10, 8),
          new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7 })
        );
        pole.position.set(side * 8.6, 5, 0);
        const lightHead = new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 0.5, 0.6),
          new THREE.MeshBasicMaterial({ color: 0xe0f2fe })
        );
        lightHead.position.set(side * 8.1, 10.1, 0);
        g.add(pole, lightHead);
      }
    }

    if (idx % 3 === 1) {
      g.add(this._createOverheadBanner(this.airportSignTex, 0x38bdf8));
    }

    return g;
  }

  _createOverheadBanner(signTex, pillarColor) {
    const g = new THREE.Group();
    const pillarMat = new THREE.MeshStandardMaterial({
      color: pillarColor,
      metalness: 0.6,
      roughness: 0.3,
    });
    const leftP = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 9.2, 10), pillarMat);
    leftP.position.set(-6.3, 4.6, 0);
    const rightP = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 9.2, 10), pillarMat);
    rightP.position.set(6.3, 4.6, 0);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(13.2, 2.7, 0.45),
      [
        pillarMat,
        pillarMat,
        pillarMat,
        pillarMat,
        new THREE.MeshBasicMaterial({ map: signTex }),
        new THREE.MeshBasicMaterial({ map: signTex }),
      ]
    );
    board.position.set(0, 8.6, 0);
    g.add(leftP, rightP, board);
    return g;
  }

  _buildFinishAirplane() {
    const g = new THREE.Group();

    // Red-gold VIP boarding carpet leading to the plane
    const carpet = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 28),
      new THREE.MeshBasicMaterial({ color: 0xdc2626 })
    );
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(0, 0.06, 12);
    g.add(carpet);

    // Golden Boarding Gate Arch ("שער רפ״ב • טיסה לאומן")
    const gateSign = createSignTexture('✈️ עולים למטוס לצדיק! ✈️', 'UMAN EXPRESS • שער רפ״ב', '#1e1b4b', '#ffd24c', '#ffffff');
    const arch = this._createOverheadBanner(gateSign, 0xffd24c);
    arch.position.set(0, 0, 8);
    g.add(arch);

    // Sleek 3D Stylized Jet Airplane parked proudly right behind the gate!
    const plane = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.35, roughness: 0.25 });
    const blueStripeMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.4, roughness: 0.3 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xd97706, emissiveIntensity: 0.35, metalness: 0.7, roughness: 0.2 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.1 });

    // Fuselage
    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.35, 19, 20), bodyMat);
    fuselage.rotation.z = Math.PI / 2;
    fuselage.position.set(0, 4.4, -10);
    plane.add(fuselage);

    // Nose cone
    const nose = new THREE.Mesh(new THREE.SphereGeometry(2.35, 20, 16), bodyMat);
    nose.scale.set(1.75, 1, 1);
    nose.position.set(-9.5, 4.4, -10);
    plane.add(nose);

    // Cockpit visor
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1.9, 14, 12), glassMat);
    cockpit.scale.set(1.3, 0.55, 0.95);
    cockpit.position.set(-10.2, 5.25, -10);
    plane.add(cockpit);

    // Blue & gold livery stripe
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 18.6, 20), blueStripeMat);
    stripe.rotation.z = Math.PI / 2;
    stripe.scale.set(1, 1, 0.24);
    stripe.position.set(0, 4.2, -10);
    plane.add(stripe);

    // Tail fin
    const tail = new THREE.Mesh(new THREE.BoxGeometry(4.2, 6.2, 0.5), blueStripeMat);
    tail.position.set(8.6, 7.6, -10);
    tail.rotation.z = -0.25;
    plane.add(tail);

    const tailGold = new THREE.Mesh(new THREE.BoxGeometry(1.4, 5.8, 0.56), goldMat);
    tailGold.position.set(8.8, 7.6, -10);
    tailGold.rotation.z = -0.25;
    plane.add(tailGold);

    // Wings
    const wing = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.45, 28), bodyMat);
    wing.position.set(-0.5, 3.6, -10);
    plane.add(wing);

    // Engines
    for (const ez of [-16, -4]) {
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 3.2, 14), blueStripeMat);
      eng.rotation.z = Math.PI / 2;
      eng.position.set(-2.2, 2.6, ez);
      plane.add(eng);
    }

    // Boarding Stairs leading up to plane door
    const stairs = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 3.6, 6.2),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6 })
    );
    stairs.position.set(-3.5, 1.8, -5.5);
    stairs.rotation.x = 0.35;
    plane.add(stairs);

    // Golden spotlights shining up at the plane
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffd24c,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    for (const bx of [-6, 6]) {
      const beam = new THREE.Mesh(new THREE.ConeGeometry(4.5, 16, 16, 1, true), beamMat);
      beam.position.set(bx, 8, -8);
      beam.rotation.z = bx > 0 ? 0.25 : -0.25;
      plane.add(beam);
    }

    g.add(plane);
    g.visible = false;
    g.position.set(0, 0, -180);
    this.scene.add(g);
    this.finishGroup = g;
  }

  _applyZoneToChunk(chunk, zoneId) {
    chunk.jerusalemProps.visible = zoneId === 'jerusalem';
    chunk.bridgeProps.visible = zoneId === 'bridge';
    chunk.airportProps.visible = zoneId === 'airport';
    chunk.zoneApplied = zoneId;
  }

  reset() {
    this.currentZoneIdx = 0;
    this.finishActive = false;
    this.finishGroup.visible = false;
    this.finishGroup.position.z = -180;

    for (let i = 0; i < this.chunks.length; i++) {
      this.chunks[i].group.position.z = 16 - i * this.chunkLength;
      this._applyZoneToChunk(this.chunks[i], 'jerusalem');
    }
    this._applyLightingImmediate(ZONES[0]);
  }

  _applyLightingImmediate(z) {
    this.skyMat.uniforms.topColor.value.setHex(z.skyTop);
    this.skyMat.uniforms.bottomColor.value.setHex(z.skyBottom);
    this.scene.fog.color.setHex(z.fogColor);
    this.scene.fog.near = z.fogNear;
    this.scene.fog.far = z.fogFar;
    this.ambientLight.color.setHex(z.ambientColor);
    this.ambientLight.intensity = z.ambientIntensity;
    this.sunLight.color.setHex(z.sunColor);
    this.sunLight.intensity = z.sunIntensity;
  }

  update(dt, speed, progressPct, remainingMeters, joyActive) {
    // Determine target zone from flight progress
    let zoneIdx = 0;
    for (let i = 0; i < ZONES.length; i++) {
      if (progressPct >= ZONES[i].startPct && progressPct < ZONES[i].endPct) {
        zoneIdx = i;
        break;
      }
    }
    const zoneChanged = zoneIdx !== this.currentZoneIdx;
    this.currentZoneIdx = zoneIdx;
    const zCfg = ZONES[zoneIdx];

    // Smoothly blend sky, fog, and sun lighting
    const lerpRate = Math.min(1, dt * 1.9);
    const targetTop = new THREE.Color(joyActive ? 0xd97706 : zCfg.skyTop);
    const targetBot = new THREE.Color(joyActive ? 0xfef08a : zCfg.skyBottom);
    const targetFog = new THREE.Color(joyActive ? 0xf59e0b : zCfg.fogColor);

    this.skyMat.uniforms.topColor.value.lerp(targetTop, lerpRate);
    this.skyMat.uniforms.bottomColor.value.lerp(targetBot, lerpRate);
    this.scene.fog.color.lerp(targetFog, lerpRate);
    this.ambientLight.color.lerp(new THREE.Color(zCfg.ambientColor), lerpRate);
    this.sunLight.color.lerp(new THREE.Color(zCfg.sunColor), lerpRate);

    // Stars glow brighter in Narrow Bridge & Airport night runway
    const targetStarOpacity = zoneIdx === 0 ? 0.18 : zoneIdx === 1 ? 0.78 : 0.95;
    this.starMat.opacity += (targetStarOpacity - this.starMat.opacity) * lerpRate;

    // Move track chunks toward player & recycle far behind
    const dz = speed * dt;
    let minZ = Infinity;
    for (const c of this.chunks) {
      c.group.position.z += dz;
      if (c.group.position.z < minZ) minZ = c.group.position.z;
    }

    // Look slightly ahead so upcoming chunks already display the next stage right as you reach the milestone!
    let aheadZoneIdx = zoneIdx;
    const lookAheadPct = Math.min(0.99, progressPct + 0.06);
    for (let i = 0; i < ZONES.length; i++) {
      if (lookAheadPct >= ZONES[i].startPct && lookAheadPct < ZONES[i].endPct) {
        aheadZoneIdx = i;
        break;
      }
    }
    const aheadZoneId = ZONES[aheadZoneIdx].id;

    for (const c of this.chunks) {
      if (c.group.position.z > 28) {
        c.group.position.z = minZ - this.chunkLength;
        minZ = c.group.position.z;
        this._applyZoneToChunk(c, aheadZoneId);
      }
    }

    // Drift clouds gently
    for (const cloud of this.cloudsGroup.children) {
      cloud.position.z += dz * 0.16;
      if (cloud.position.z > 25) {
        cloud.position.z = -160;
        cloud.position.x = (Math.random() - 0.5) * 140;
      }
    }

    // Reveal the waiting Airplane & Boarding Gate as player enters final 135m!
    if (remainingMeters <= 135) {
      this.finishGroup.visible = true;
      // Map remainingMeters directly to Z position ahead of player (player is at z = 0)
      this.finishGroup.position.z = -remainingMeters - 6;
    } else {
      this.finishGroup.visible = false;
    }

    return { zoneChanged, zone: zCfg };
  }
}
