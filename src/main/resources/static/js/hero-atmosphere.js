







const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;

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

function makeButterfly(seed, width, height, edge = null) {
  const random = rng(seed);
  const scale = 0.3 + random() * 0.8;
  return {
    x: edge === "right" ? width + 30 : edge === "left" ? -30 : random() * width,
    baseY: height * (0.08 + random() * 0.64),
    size: 7 + scale * 18,
    depth: 0.18 + random() * 0.78,
    speed: (10 + random() * 24) * (edge === "right" ? -1 : 1),
    phase: random() * TAU,
    flap: 2.7 + random() * 2.8,
    wobble: 0.22 + random() * 0.42,
    amp: 6 + random() * 26,
    tilt: (random() - 0.5) * 0.8,
    life: 0,
    lifeSpan: 14 + random() * 18,
    alpha: 0,
  };
}

export function createHeroAtmosphere(hero) {
  if (!hero) return () => {};
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wrap = document.createElement("div");
  wrap.className = "hero__atmosphere";
  wrap.setAttribute("aria-hidden", "true");

  const canvas = document.createElement("canvas");
  canvas.className = "hero__canvas";
  wrap.append(canvas);

  for (const name of ["hero__fog--one", "hero__fog--two", "hero__fog--three"]) {
    const fog = document.createElement("div");
    fog.className = `hero__fog ${name}`;
    wrap.append(fog);
  }
  for (const name of ["hero__light--one", "hero__light--two"]) {
    const light = document.createElement("div");
    light.className = `hero__light ${name}`;
    wrap.append(light);
  }
  const veil = document.createElement("div");
  veil.className = "hero__veil";
  wrap.append(veil);
  hero.prepend(wrap);

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return () => {};

  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    time: 0,
    scroll: 0,
    pointerX: 0,
    pointerY: 0,
    visible: true,
    raf: 0,
    last: 0,
    trees: [],
    butterflies: [],
    dust: [],
    sky: null,
    ground: null,
  };

  function resize() {
    const rect = hero.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    const nextWidth = Math.max(320, Math.round(rect.width));
    const nextHeight = Math.max(420, Math.round(rect.height));
    if (nextWidth === state.width && nextHeight === state.height) return;
    state.width = nextWidth;
    state.height = nextHeight;
    state.dpr = Math.min(window.devicePixelRatio || 1, state.width < 700 ? 1.5 : 2);
    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    state.sky = ctx.createLinearGradient(0, 0, 0, state.height);
    state.sky.addColorStop(0, "#07120d");
    state.sky.addColorStop(0.48, "#0d2117");
    state.sky.addColorStop(0.8, "#132b1e");
    state.sky.addColorStop(1, "#08130e");
    state.ground = ctx.createLinearGradient(0, state.height * 0.6, 0, state.height);
    state.ground.addColorStop(0, "rgba(20, 36, 25, 0)");
    state.ground.addColorStop(1, "rgba(3, 9, 6, 0.92)");
    build();
    if (reduced) draw();
  }

  function build() {
    state.trees = [];
    const layers = [
      { depth: 0.18, count: 11, color: "#08140d", alpha: 0.55, height: 0.45, margin: false },
      { depth: 0.42, count: 9, color: "#0a1b12", alpha: 0.78, height: 0.68, margin: false },
      { depth: 0.72, count: 7, color: "#06100b", alpha: 0.96, height: 0.92, margin: true },
    ];
    layers.forEach((layer, layerIndex) => {
      const random = rng(91 + layerIndex * 37);
      for (let i = 0; i < layer.count; i += 1) {
        let x = random();
        if (layer.margin && x > 0.24 && x < 0.76) {
          x = x < 0.5 ? 0.12 + random() * 0.1 : 0.79 + random() * 0.1;
        }
        state.trees.push({
          layer: layerIndex,
          x,
          height: state.height * (layer.height * (0.72 + random() * 0.38)),
          width: state.width * (0.028 + random() * 0.05) * (1 + layerIndex * 0.28),
          phase: random() * TAU,
          lean: (random() - 0.5) * 0.14,
          color: layer.color,
          alpha: layer.alpha,
          depth: layer.depth,
        });
      }
    });

    const count = reduced ? 4 : state.width < 560 ? 8 : state.width < 1000 ? 12 : 16;
    state.butterflies = Array.from({ length: count }, (_, index) =>
      makeButterfly(500 + index * 73, state.width, state.height)
    );
    if (!reduced && state.width > 700) {
      const foreground = makeButterfly(8801, state.width, state.height);
      foreground.x = state.width * 0.64;
      foreground.baseY = state.height * 0.43;
      foreground.size = 24;
      foreground.depth = 0.96;
      foreground.speed = -7;
      foreground.alpha = 1;
      state.butterflies.push(foreground);
    }
    if (reduced) {
      for (const butterfly of state.butterflies) butterfly.alpha = 1;
    }

    const dustCount = reduced ? 18 : state.width < 560 ? 26 : 42;
    const random = rng(240);
    state.dust = Array.from({ length: dustCount }, () => ({
      x: random() * state.width,
      y: random() * state.height,
      size: 0.5 + random() * 1.6,
      speed: 2 + random() * 8,
      drift: (random() - 0.5) * 4,
      alpha: 0.08 + random() * 0.22,
      phase: random() * TAU,
    }));
  }

  function drawTree(tree, time) {
    const { width, height } = state;
    const x = tree.x * width + state.pointerX * tree.depth * 18;
    const baseY = height + 4;
    const treeHeight = tree.height;
    const sway = Math.sin(time * 0.16 + tree.phase) * 4 * tree.depth + tree.lean * 16;
    ctx.save();
    ctx.globalAlpha = tree.alpha;
    ctx.fillStyle = tree.color;
    ctx.beginPath();
    ctx.moveTo(x - tree.width * 0.12, baseY);
    ctx.lineTo(x + tree.width * 0.12, baseY);
    ctx.lineTo(x + sway + tree.width * 0.05, baseY - treeHeight * 0.68);
    ctx.lineTo(x + sway - tree.width * 0.04, baseY - treeHeight * 0.68);
    ctx.closePath();
    ctx.fill();

    const tiers = tree.layer === 0 ? 5 : 8;
    for (let i = 0; i < tiers; i += 1) {
      const ratio = i / (tiers - 1);
      const y = baseY - treeHeight * (0.18 + ratio * 0.8);
      const half = tree.width * (1 - ratio * 0.84) * (0.9 + Math.sin(i * 2.3) * 0.08);
      const shift = sway * (0.25 + ratio * 0.75);
      ctx.beginPath();
      ctx.moveTo(x + shift, y - treeHeight * 0.14);
      ctx.quadraticCurveTo(x + shift - half * 0.45, y - treeHeight * 0.01,
        x + shift - half, y + treeHeight * 0.08);
      ctx.quadraticCurveTo(x + shift - half * 0.42, y + treeHeight * 0.02,
        x + shift, y + treeHeight * 0.06);
      ctx.quadraticCurveTo(x + shift + half * 0.42, y + treeHeight * 0.02,
        x + shift + half, y + treeHeight * 0.08);
      ctx.quadraticCurveTo(x + shift + half * 0.45, y - treeHeight * 0.01,
        x + shift, y - treeHeight * 0.14);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGround() {
    const { width, height } = state;
    ctx.save();
    ctx.fillStyle = state.ground;
    ctx.fillRect(0, height * 0.55, width, height * 0.45);

    
    const center = width * 0.58;
    ctx.beginPath();
    ctx.moveTo(width * 0.46, height + 2);
    ctx.bezierCurveTo(width * 0.49, height * 0.88, center - width * 0.025, height * 0.74,
      center, height * 0.67);
    ctx.lineTo(center + width * 0.012, height * 0.67);
    ctx.bezierCurveTo(center + width * 0.04, height * 0.76, width * 0.54, height * 0.9,
      width * 0.66, height + 2);
    ctx.closePath();
    ctx.fillStyle = "rgba(189, 164, 126, 0.09)";
    ctx.fill();

    
    const random = rng(711);
    for (let i = 0; i < 18; i += 1) {
      const fx = (i < 9 ? width * (0.08 + random() * 0.2) : width * (0.77 + random() * 0.16));
      const fy = height * (0.78 + random() * 0.18);
      const size = 1.3 + random() * 2.2;
      ctx.strokeStyle = "rgba(170, 174, 123, 0.2)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + (random() - 0.5) * 5, fy - size * 4);
      ctx.stroke();
      ctx.fillStyle = "rgba(230, 213, 177, 0.2)";
      ctx.beginPath();
      ctx.arc(fx + (random() - 0.5) * 4, fy - size * 4, size * 0.55, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawDust(time) {
    ctx.save();
    for (const particle of state.dust) {
      const y = ((particle.y - time * particle.speed) % state.height + state.height) % state.height;
      const x = (particle.x + Math.sin(time * 0.2 + particle.phase) * 12) % state.width;
      ctx.globalAlpha = particle.alpha * (0.5 + Math.sin(time * 0.8 + particle.phase) * 0.5);
      ctx.fillStyle = "#f4dcb2";
      ctx.beginPath();
      ctx.arc(x, y, particle.size, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawWing(side, flap, size) {
    ctx.save();
    ctx.scale(side * flap, 1);
    ctx.lineJoin = "round";

    
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(4, -7, 13, -15, 22, -11);
    ctx.bezierCurveTo(28, -8, 24, -2, 17, 2);
    ctx.bezierCurveTo(11, 5, 4, 4, 0, 2);
    ctx.closePath();
    ctx.fillStyle = "#d9782d";
    ctx.fill();
    ctx.strokeStyle = "#1b100a";
    ctx.lineWidth = Math.max(0.55, size * 0.035);
    ctx.stroke();

    
    ctx.beginPath();
    ctx.moveTo(1, 3);
    ctx.bezierCurveTo(8, 5, 14, 11, 12, 18);
    ctx.bezierCurveTo(10, 23, 5, 22, 2, 17);
    ctx.bezierCurveTo(0, 12, 0, 7, 1, 3);
    ctx.closePath();
    ctx.fillStyle = "#c86a24";
    ctx.fill();
    ctx.strokeStyle = "#1b100a";
    ctx.stroke();

    
    ctx.strokeStyle = "rgba(25, 14, 8, 0.86)";
    ctx.lineWidth = Math.max(0.4, size * 0.026);
    for (const [x1, y1, x2, y2] of [
      [2, 0, 20, -8],
      [3, 2, 22, -3],
      [2, 2, 15, 1],
      [3, 5, 11, 14],
      [2, 8, 8, 18],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo((x1 + x2) * 0.5, (y1 + y2) * 0.5 - 2, x2, y2);
      ctx.stroke();
    }

    
    ctx.fillStyle = "rgba(250, 243, 226, 0.9)";
    for (const [x, y, r] of [
      [18, -10, 0.9], [21, -7, 0.7], [23, -3, 0.8], [17, -1, 0.65],
      [10, 16, 0.7], [8, 19, 0.55], [13, 14, 0.5],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, r * Math.max(0.6, size * 0.06), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawButterfly(butterfly, time) {
    const { width, height } = state;
    const scroll = state.scroll * height * 0.2 * butterfly.depth;
    const x = butterfly.x + state.pointerX * butterfly.depth * 28;
    const y = butterfly.baseY
      + Math.sin(time * butterfly.wobble + butterfly.phase) * butterfly.amp
      - scroll
      + state.pointerY * butterfly.depth * 12;
    if (x < -80 || x > width + 80 || y < -60 || y > height + 60) return;

    const flap = 0.14 + Math.abs(Math.sin(time * butterfly.flap + butterfly.phase)) * 0.9;
    const rotation = Math.sin(time * 0.35 + butterfly.phase) * 0.25 + butterfly.tilt;
    const scale = butterfly.size / 22 * (0.7 + butterfly.depth * 0.6);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);
    ctx.globalAlpha = butterfly.alpha * (0.34 + butterfly.depth * 0.74);

    
    drawWing(-1, flap, butterfly.size);
    drawWing(1, flap, butterfly.size);

    
    ctx.fillStyle = "#1a0f09";
    ctx.beginPath();
    ctx.ellipse(0, 3, 1.35, 7.5, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -4.3, 1.55, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(24, 15, 9, 0.9)";
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.moveTo(-0.6, -5);
    ctx.quadraticCurveTo(-4, -10, -7, -11);
    ctx.moveTo(0.6, -5);
    ctx.quadraticCurveTo(4, -10, 7, -11);
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    const { width, height } = state;
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = state.sky;
    ctx.fillRect(0, 0, width, height);

    const time = state.time;
    
    for (const tree of state.trees.filter((item) => item.layer === 0)) drawTree(tree, time);
    for (const tree of state.trees.filter((item) => item.layer === 1)) drawTree(tree, time);
    drawGround();
    drawDust(time);

    
    for (const butterfly of state.butterflies.filter((item) => item.depth < 0.68)) {
      drawButterfly(butterfly, time);
    }
    
    for (const tree of state.trees.filter((item) => item.layer === 2)) drawTree(tree, time);
    
    for (const butterfly of state.butterflies.filter((item) => item.depth >= 0.68)) {
      drawButterfly(butterfly, time);
    }
  }

  function update(dt) {
    state.time += dt;
    for (const butterfly of state.butterflies) {
      butterfly.life += dt;
      butterfly.x += butterfly.speed * dt * (0.45 + butterfly.depth);
      if (butterfly.life > butterfly.lifeSpan || butterfly.x < -70 || butterfly.x > state.width + 70) {
        const replacement = makeButterfly(
          900 + Math.floor(state.time * 1000) + Math.floor(Math.random() * 10000),
          state.width,
          state.height,
          butterfly.x < 0 ? "right" : "left"
        );
        Object.assign(butterfly, replacement);
      }
      butterfly.alpha = Math.min(1, butterfly.life / 1.8)
        * Math.min(1, (butterfly.lifeSpan - butterfly.life) / 1.8);
    }
  }

  function frame(now) {
    state.raf = requestAnimationFrame(frame);
    if (!state.visible || document.hidden) return;
    const elapsed = state.last ? Math.min(0.05, (now - state.last) / 1000) : 0.016;
    state.last = now;
    if (elapsed <= 0) return;
    update(elapsed);
    draw();
  }

  function onScroll() {
    const rect = hero.getBoundingClientRect();
    state.scroll = clamp(-rect.top / Math.max(1, rect.height), 0, 1);
  }

  function onPointer(event) {
    const rect = hero.getBoundingClientRect();
    state.pointerX = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
    state.pointerY = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
  }

  function onPointerLeave() {
    state.pointerX = 0;
    state.pointerY = 0;
  }

  function start() {
    if (reduced || state.raf) return;
    state.last = 0;
    state.raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (!state.raf) return;
    cancelAnimationFrame(state.raf);
    state.raf = 0;
  }

  function onVisibility() {
    state.visible = !document.hidden;
    if (document.hidden) stop();
    else start();
  }

  const observer = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        state.visible = entries.some((entry) => entry.isIntersecting);
        if (state.visible) start();
        else stop();
      }, { threshold: 0.02 })
    : null;

  const onResize = () => {
    resize();
    onScroll();
  };

  const resizeObserver = "ResizeObserver" in window
    ? new ResizeObserver(onResize)
    : null;

  hero.addEventListener("pointermove", onPointer, { passive: true });
  hero.addEventListener("pointerleave", onPointerLeave, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  resizeObserver?.observe(hero);
  observer?.observe(hero);

  resize();
  requestAnimationFrame(onResize);
  onScroll();
  if (reduced) {
    draw();
  } else {
    start();
  }

  return () => {
    stop();
    observer?.disconnect();
    resizeObserver?.disconnect();
    hero.removeEventListener("pointermove", onPointer);
    hero.removeEventListener("pointerleave", onPointerLeave);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    wrap.remove();
  };
}
