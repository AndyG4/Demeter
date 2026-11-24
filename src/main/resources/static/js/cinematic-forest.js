







const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smooth = (edge0, edge1, value) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

function rng(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createButterfly(seed, width, height, group) {
  const random = rng(seed);
  const scale = 0.24 + random() * 0.7;
  return {
    group,
    x: random() * width,
    baseY: height * (0.08 + random() * 0.64),
    size: 6 + scale * 18,
    depth: 0.16 + random() * 0.82,
    speed: (8 + random() * 22) * (random() > 0.5 ? 1 : -1),
    phase: random() * TAU,
    flap: 2.2 + random() * 3.4,
    wobble: 0.16 + random() * 0.35,
    amp: 4 + random() * 20,
    tilt: (random() - 0.5) * 0.65,
    life: random() * 8,
    lifeSpan: 14 + random() * 20,
    orbit: random() * TAU,
    orbitRadius: 4 + random() * 18,
  };
}

export function createCinematicForest(chapter) {
  if (!chapter) return () => {};
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stage = document.createElement("div");
  stage.className = "cinematic-stage";
  stage.setAttribute("aria-hidden", "true");
  const canvas = document.createElement("canvas");
  canvas.className = "cinematic-canvas";
  stage.append(canvas);

  for (const name of ["cinematic-fog--one", "cinematic-fog--two", "cinematic-fog--three"]) {
    const fog = document.createElement("div");
    fog.className = `cinematic-fog ${name}`;
    stage.append(fog);
  }
  for (const name of ["cinematic-light--one", "cinematic-light--two"]) {
    const light = document.createElement("div");
    light.className = `cinematic-light ${name}`;
    stage.append(light);
  }
  const veil = document.createElement("div");
  veil.className = "cinematic-veil";
  stage.append(veil);
  chapter.prepend(stage);

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return () => {};

  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    time: 0,
    progress: 0,
    active: false,
    raf: 0,
    last: 0,
    trees: [],
    butterflies: [],
    dust: [],
    sky: null,
  };

  function resize() {
    const width = Math.max(320, window.innerWidth);
    const height = Math.max(420, window.innerHeight);
    if (width === state.width && height === state.height) return;
    state.width = width;
    state.height = height;
    state.dpr = Math.min(window.devicePixelRatio || 1, width < 700 ? 1.5 : 2);
    canvas.width = Math.round(width * state.dpr);
    canvas.height = Math.round(height * state.dpr);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    state.sky = ctx.createLinearGradient(0, 0, 0, height);
    state.sky.addColorStop(0, "#07140d");
    state.sky.addColorStop(0.42, "#10291b");
    state.sky.addColorStop(0.72, "#1a3824");
    state.sky.addColorStop(1, "#0a1710");
    build();
    if (reduced) draw();
  }

  function build() {
    const random = rng(551);
    state.trees = [];
    const layers = [
      { depth: 0.12, count: 14, color: "#0a2115", alpha: 0.78, height: 0.52 },
      { depth: 0.32, count: 10, color: "#0b2a1a", alpha: 0.88, height: 0.74 },
      { depth: 0.62, count: 7, color: "#06150d", alpha: 1, height: 0.98 },
    ];
    for (let layer = 0; layer < layers.length; layer += 1) {
      const layerData = layers[layer];
      for (let i = 0; i < layerData.count; i += 1) {
        let x = random();
        if (layer === 2 && x > 0.25 && x < 0.78) {
          x = x < 0.5 ? 0.1 + random() * 0.12 : 0.8 + random() * 0.15;
        }
        state.trees.push({
          layer,
          x,
          height: state.height * layerData.height * (0.72 + random() * 0.36),
          width: state.width * (0.03 + random() * 0.06) * (1 + layer * 0.25),
          phase: random() * TAU,
          color: layerData.color,
          alpha: layerData.alpha,
          depth: layerData.depth,
        });
      }
    }

    const migration = reduced ? 8 : 18;
    const cluster = reduced ? 6 : 12;
    const sanctuary = reduced ? 5 : 8;
    state.butterflies = [];
    for (let i = 0; i < migration; i += 1) {
      state.butterflies.push(createButterfly(900 + i * 31, state.width, state.height, 0));
    }
    for (let i = 0; i < cluster; i += 1) {
      const butterfly = createButterfly(1600 + i * 37, state.width, state.height, 1);
      butterfly.clusterX = state.width * (0.48 + random() * 0.46);
      butterfly.clusterY = state.height * (0.08 + random() * 0.48);
      state.butterflies.push(butterfly);
    }
    for (let i = 0; i < sanctuary; i += 1) {
      
      state.butterflies.push(createButterfly(2400 + i * 41, state.width, state.height, 2));
    }

    const dustCount = reduced ? 18 : Math.round((state.width * state.height) / 36000);
    const randomDust = rng(88);
    state.dust = Array.from({ length: dustCount }, () => ({
      x: randomDust() * state.width,
      y: randomDust() * state.height,
      r: 0.4 + randomDust() * 1.4,
      phase: randomDust() * TAU,
      alpha: 0.06 + randomDust() * 0.18,
      speed: 1 + randomDust() * 5,
    }));

    
    
    const swarmCount = reduced ? 20 : state.width < 700 ? 45 : 95;
    const randomSwarm = rng(1201);
    state.swarm = Array.from({ length: swarmCount }, () => ({
      x: randomSwarm() * state.width,
      y: state.height * (0.08 + randomSwarm() * 0.62),
      size: 0.7 + randomSwarm() * 2.1,
      phase: randomSwarm() * TAU,
      speed: 2 + randomSwarm() * 8,
      depth: 0.2 + randomSwarm() * 0.7,
    }));
  }

  function drawFir(tree, time, zoom) {
    const { width, height } = state;
    const x = tree.x * width;
    const baseY = height + 8;
    const sway = Math.sin(time * 0.11 + tree.phase) * 3 * tree.depth;
    ctx.save();
    ctx.globalAlpha = tree.alpha;
    ctx.fillStyle = tree.color;
    const trunkWidth = tree.width * 0.14;
    ctx.beginPath();
    ctx.moveTo(x - trunkWidth, baseY);
    ctx.lineTo(x + trunkWidth, baseY);
    ctx.lineTo(x + sway + trunkWidth * 0.55, baseY - tree.height * 0.62);
    ctx.lineTo(x + sway - trunkWidth * 0.55, baseY - tree.height * 0.62);
    ctx.closePath();
    ctx.fill();
    const tiers = tree.layer === 0 ? 5 : 8;
    for (let i = 0; i < tiers; i += 1) {
      const ratio = i / (tiers - 1);
      const y = baseY - tree.height * (0.12 + ratio * 0.82);
      const half = tree.width * (1 - ratio * 0.86);
      const shift = sway * (0.2 + ratio * 0.8);
      ctx.beginPath();
      ctx.moveTo(x + shift, y - tree.height * 0.12);
      ctx.quadraticCurveTo(x + shift - half * 0.5, y,
        x + shift - half, y + tree.height * 0.07);
      ctx.quadraticCurveTo(x + shift - half * 0.4, y + tree.height * 0.01,
        x + shift, y + tree.height * 0.05);
      ctx.quadraticCurveTo(x + shift + half * 0.4, y + tree.height * 0.01,
        x + shift + half, y + tree.height * 0.07);
      ctx.quadraticCurveTo(x + shift + half * 0.5, y,
        x + shift, y - tree.height * 0.12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBranch(time, progress) {
    if (progress < 0.14) return;
    const alpha = smooth(0.14, 0.32, progress) * 0.72;
    const w = state.width;
    const h = state.height;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#020906";
    ctx.lineWidth = Math.max(5, w * 0.007);
    ctx.lineCap = "round";
    for (const branch of [
      [0.0, 0.22, 0.38, 0.18], [0.62, 0.3, 1.0, 0.2], [0.08, 0.05, 0.48, 0.13],
    ]) {
      ctx.beginPath();
      ctx.moveTo(branch[0] * w, branch[1] * h);
      ctx.quadraticCurveTo((branch[0] + branch[2]) * 0.5 * w,
        (branch[1] + branch[3]) * 0.5 * h - h * 0.03,
        branch[2] * w, branch[3] * h);
      ctx.stroke();
      
      for (let i = 1; i < 12; i += 1) {
        const t = i / 12;
        const x = (branch[0] + (branch[2] - branch[0]) * t) * w;
        const y = (branch[1] + (branch[3] - branch[1]) * t) * h;
        const sway = Math.sin(time * 0.2 + i) * 1.2;
        ctx.strokeStyle = "rgba(3, 10, 6, 0.7)";
        ctx.lineWidth = 1.1;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + side * 8, y + 3 + sway, x + side * 12, y + 11 + sway);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  function drawWing(side, flap, size) {
    ctx.save();
    ctx.scale(side * flap, 1);
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(5, -8, 14, -17, 23, -12);
    ctx.bezierCurveTo(29, -8, 25, -1, 17, 3);
    ctx.bezierCurveTo(10, 6, 4, 5, 0, 2);
    ctx.closePath();
    ctx.fillStyle = "#d9772d";
    ctx.fill();
    ctx.strokeStyle = "#1a0f09";
    ctx.lineWidth = Math.max(0.55, size * 0.035);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(1, 3);
    ctx.bezierCurveTo(9, 6, 15, 12, 13, 19);
    ctx.bezierCurveTo(10, 24, 5, 22, 2, 17);
    ctx.bezierCurveTo(0, 12, 0, 7, 1, 3);
    ctx.closePath();
    ctx.fillStyle = "#c96822";
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(24, 14, 8, 0.86)";
    ctx.lineWidth = Math.max(0.4, size * 0.025);
    for (const [x1, y1, x2, y2] of [
      [2, 0, 21, -8], [2, 2, 23, -3], [2, 2, 16, 1], [2, 5, 11, 14], [1, 8, 8, 18],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo((x1 + x2) * 0.5, (y1 + y2) * 0.5 - 1.5, x2, y2);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(250, 243, 226, 0.92)";
    for (const [x, y, r] of [
      [19, -10, 0.9], [22, -7, 0.75], [24, -3, 0.8], [18, -1, 0.65],
      [11, 17, 0.75], [8, 20, 0.55], [14, 15, 0.55],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, r * Math.max(0.6, size * 0.06), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawButterfly(butterfly, time, weight) {
    if (weight < 0.01) return;
    const { width, height } = state;
    let x = butterfly.x;
    let y = butterfly.baseY;
    if (butterfly.group === 1) {
      x = butterfly.clusterX + Math.sin(time * 0.2 + butterfly.orbit) * butterfly.orbitRadius;
      y = butterfly.clusterY + Math.cos(time * 0.17 + butterfly.phase) * 5;
    } else {
      x += Math.sin(time * 0.17 + butterfly.phase) * butterfly.amp;
      y += Math.sin(time * butterfly.wobble + butterfly.phase) * butterfly.amp * 0.5;
    }
    if (x < -80 || x > width + 80 || y < -60 || y > height + 60) return;
    const flap = butterfly.group === 1
      ? 0.3 + Math.abs(Math.sin(time * 0.8 + butterfly.phase)) * 0.7
      : 0.16 + Math.abs(Math.sin(time * butterfly.flap + butterfly.phase)) * 0.9;
    const rotation = Math.sin(time * 0.27 + butterfly.phase) * 0.22 + butterfly.tilt;
    const scale = butterfly.size / 24 * (0.7 + butterfly.depth * 0.6);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);
    ctx.globalAlpha = weight * (0.3 + butterfly.depth * 0.75);
    ctx.save();
    ctx.scale(flap, 1);
    drawWing(-1, 1, butterfly.size);
    drawWing(1, 1, butterfly.size);
    ctx.restore();
    ctx.fillStyle = "#1a0f09";
    ctx.beginPath();
    ctx.ellipse(0, 3, 1.3, 7, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -4, 1.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(24, 15, 9, 0.9)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-0.5, -5);
    ctx.quadraticCurveTo(-4, -10, -7, -11);
    ctx.moveTo(0.5, -5);
    ctx.quadraticCurveTo(4, -10, 7, -11);
    ctx.stroke();
    ctx.restore();
  }

  function drawMacroWing(progress) {
    const weight = smooth(0.32, 0.48, progress) * (1 - smooth(0.64, 0.8, progress));
    if (weight < 0.02) return;
    const w = state.width;
    const h = state.height;
    ctx.save();
    ctx.globalAlpha = weight * 0.15;
    ctx.translate(w * 0.83, h * 0.53);
    ctx.rotate(-0.28);
    ctx.scale(2.8, 2.8);
    drawWing(-1, 1, 22);
    ctx.restore();
  }

  function drawDust(time) {
    ctx.save();
    for (const particle of state.dust) {
      const x = particle.x + Math.sin(time * 0.15 + particle.phase) * 8;
      const y = ((particle.y - time * particle.speed) % state.height + state.height) % state.height;
      ctx.globalAlpha = particle.alpha;
      ctx.fillStyle = "#f3d9ae";
      ctx.beginPath();
      ctx.arc(x, y, particle.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCanopy(time, progress) {
    const weight = smooth(0.03, 0.2, progress) * (1 - smooth(0.82, 1, progress) * 0.5);
    if (weight < 0.02) return;
    const w = state.width;
    const h = state.height;
    ctx.save();
    ctx.globalAlpha = 0.58 * weight;
    ctx.fillStyle = "#06150e";
    const random = rng(3001);
    for (let i = 0; i < 9; i += 1) {
      const x = (i / 8) * w + (random() - 0.5) * w * 0.12;
      const y = h * (0.02 + random() * 0.08);
      const rx = w * (0.06 + random() * 0.12);
      const ry = h * (0.05 + random() * 0.1);
      ctx.beginPath();
      ctx.ellipse(x, y - Math.sin(time * 0.18 + i) * 3, rx, ry, random() * 0.3, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSwarm(time, progress) {
    const migrationWeight = 1 - smooth(0.22, 0.42, progress);
    const clusterWeight = smooth(0.22, 0.42, progress) * (1 - smooth(0.64, 0.82, progress));
    const sanctuaryWeight = smooth(0.64, 0.82, progress);
    const weight = migrationWeight * 0.9 + clusterWeight * 0.45 + sanctuaryWeight * 0.65;
    if (weight < 0.02) return;
    ctx.save();
    for (const dot of state.swarm) {
      const x = dot.x + Math.sin(time * 0.13 + dot.phase) * 18;
      const y = dot.y + Math.cos(time * 0.11 + dot.phase) * 10;
      const alpha = weight * (0.14 + dot.depth * 0.34);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#e2903b";
      ctx.beginPath();
      ctx.arc(x, y, dot.size, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function draw() {
    const { width, height } = state;
    if (!width || !height) return;
    const p = state.progress;
    const zoom = 1 + smooth(0, 0.48, p) * 0.24 - smooth(0.62, 1, p) * 0.08;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = state.sky;
    ctx.fillRect(0, 0, width, height);

    
    const ground = ctx.createLinearGradient(0, height * 0.58, 0, height);
    ground.addColorStop(0, "rgba(23, 49, 31, 0)");
    ground.addColorStop(1, "rgba(4, 11, 7, 0.92)");
    ctx.fillStyle = ground;
    ctx.fillRect(0, height * 0.55, width, height * 0.45);

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-width / 2, -height / 2);
    for (const tree of state.trees.filter((item) => item.layer === 0)) drawFir(tree, state.time, zoom);
    for (const tree of state.trees.filter((item) => item.layer === 1)) drawFir(tree, state.time, zoom);
    drawCanopy(state.time, p);
    drawBranch(state.time, p);
    drawSwarm(state.time, p);
    drawDust(state.time);

    const migrationWeight = 1 - smooth(0.22, 0.42, p);
    const clusterWeight = smooth(0.22, 0.42, p) * (1 - smooth(0.64, 0.82, p));
    const sanctuaryWeight = smooth(0.64, 0.82, p);
    const weights = [migrationWeight, clusterWeight, sanctuaryWeight];
    for (const butterfly of state.butterflies) {
      drawButterfly(butterfly, state.time, weights[butterfly.group]);
    }
    drawMacroWing(p);
    for (const tree of state.trees.filter((item) => item.layer === 2)) drawFir(tree, state.time, zoom);
    ctx.restore();
  }

  function update(dt) {
    state.time += dt;
    const { width, height } = state;
    for (const butterfly of state.butterflies) {
      butterfly.life += dt;
      if (butterfly.group !== 1) {
        butterfly.x += butterfly.speed * dt * (0.4 + butterfly.depth);
        if (butterfly.x < -80) butterfly.x = width + 60;
        if (butterfly.x > width + 80) butterfly.x = -60;
      }
      if (butterfly.life > butterfly.lifeSpan) {
        butterfly.life = 0;
        if (butterfly.group === 1) {
          butterfly.clusterX = width * (0.48 + Math.random() * 0.46);
          butterfly.clusterY = height * (0.08 + Math.random() * 0.48);
        } else {
          butterfly.x = butterfly.speed > 0 ? -40 : width + 40;
          butterfly.baseY = height * (0.08 + Math.random() * 0.62);
        }
      }
    }
  }

  function measure() {
    const rect = chapter.getBoundingClientRect();
    const viewport = window.innerHeight;
    const total = Math.max(1, chapter.offsetHeight - viewport);
    state.progress = clamp(-rect.top / total, 0, 1);
    const active = rect.bottom > 0 && rect.top < viewport;
    if (active !== state.active) {
      state.active = active;
      stage.classList.toggle("is-active", active);
      if (active) start();
      else stop();
    }
    stage.classList.toggle("is-intimate", state.progress >= 0.28 && state.progress < 0.7);
    stage.classList.toggle("is-sanctuary", state.progress >= 0.65);
  }

  function frame(now) {
    state.raf = requestAnimationFrame(frame);
    if (!state.active || document.hidden) return;
    if (now - state.last < 1000 / 30) return;
    const dt = state.last ? Math.min(0.05, (now - state.last) / 1000) : 0.016;
    state.last = now;
    update(dt);
    draw();
  }

  function start() {
    if (reduced || state.raf) return;
    state.last = 0;
    state.raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
  }
  function onScroll() {
    measure();
  }
  function onResize() {
    resize();
    measure();
    if (reduced) draw();
  }
  function onVisibility() {
    if (document.hidden) stop();
    else if (state.active) start();
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  resize();
  measure();
  if (reduced) draw();
  else if (state.active) start();

  return () => {
    stop();
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    stage.remove();
  };
}
