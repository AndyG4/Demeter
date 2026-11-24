










const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

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

export function createHeritageAtmosphere(section, variant = "taller") {
  if (!section) return () => {};
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wrap = document.createElement("div");
  wrap.className = `heritage-atmosphere heritage-atmosphere--${variant}`;
  wrap.setAttribute("aria-hidden", "true");
  const canvas = document.createElement("canvas");
  canvas.className = "heritage-canvas";
  wrap.append(canvas);
  const veil = document.createElement("div");
  veil.className = "heritage-veil";
  wrap.append(veil);
  section.prepend(wrap);

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return () => {};

  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    time: 0,
    raf: 0,
    visible: true,
    last: 0,
    pointerX: 0,
    pointerY: 0,
    dust: [],
    stalks: [],
    threads: [],
  };

  function resize() {
    const rect = wrap.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    const width = Math.max(320, Math.round(rect.width));
    const height = Math.max(220, Math.round(rect.height));
    if (width === state.width && height === state.height) return;
    state.width = width;
    state.height = height;
    state.dpr = Math.min(window.devicePixelRatio || 1, width < 700 ? 1.5 : 2);
    canvas.width = Math.round(width * state.dpr);
    canvas.height = Math.round(height * state.dpr);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    build();
    if (reduced) draw();
  }

  function build() {
    const random = rng(variant === "taller" ? 41 : variant === "adobe" ? 73 : 109);
    state.dust = Array.from({ length: Math.round((state.width * state.height) / 22000) }, () => ({
      x: random() * state.width,
      y: random() * state.height,
      r: 0.5 + random() * 1.4,
      drift: (random() - 0.5) * 7,
      phase: random() * TAU,
      alpha: 0.08 + random() * 0.2,
    }));
    state.threads = Array.from({ length: 26 }, (_, index) => ({
      x: state.width * (0.6 + random() * 0.34),
      phase: random() * TAU,
      length: state.height * (0.18 + random() * 0.5),
      hue: index % 4,
    }));
    state.stalks = Array.from({ length: 34 }, (_, index) => ({
      x: state.width * (0.04 + random() * 0.82),
      height: state.height * (0.28 + random() * 0.52),
      phase: random() * TAU,
      lean: (random() - 0.5) * 0.12,
      leaves: 3 + Math.floor(random() * 4),
    }));
  }

  function drawSky() {
    const gradient = ctx.createLinearGradient(0, 0, 0, state.height);
    if (variant === "milpa") {
      gradient.addColorStop(0, "#3b2b20");
      gradient.addColorStop(0.52, "#6d4a2a");
      gradient.addColorStop(1, "#1b2418");
    } else if (variant === "adobe") {
      gradient.addColorStop(0, "#2a1d16");
      gradient.addColorStop(0.55, "#4a3022");
      gradient.addColorStop(1, "#1a1610");
    } else {
      gradient.addColorStop(0, "#241a14");
      gradient.addColorStop(0.55, "#3f2b1e");
      gradient.addColorStop(1, "#15130f");
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, state.width, state.height);
  }

  function drawAdobeTexture() {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = "#d8b185";
    ctx.lineWidth = 0.7;
    const size = 54;
    for (let y = 0; y < state.height; y += size) {
      for (let x = 0; x < state.width; x += size) {
        const offset = ((y / size) % 2) * size * 0.5;
        ctx.strokeRect(x + offset, y, size, size);
      }
    }
    ctx.restore();
  }

  function drawWorkshop(time) {
    drawSky();
    drawAdobeTexture();
    const w = state.width;
    const h = state.height;
    const px = state.pointerX * 10;

    
    ctx.fillStyle = "rgba(240, 191, 120, 0.1)";
    ctx.fillRect(w * 0.05 + px * 0.2, h * 0.08, w * 0.2, h * 0.44);
    ctx.fillStyle = "rgba(245, 210, 155, 0.06)";
    ctx.fillRect(w * 0.08 + px * 0.2, h * 0.11, w * 0.14, h * 0.38);

    
    ctx.strokeStyle = "rgba(92, 60, 38, 0.9)";
    ctx.lineWidth = Math.max(4, w * 0.009);
    const loomX = w * 0.64 + px;
    const loomTop = h * 0.08;
    const loomBottom = h * 0.9;
    ctx.beginPath();
    ctx.moveTo(loomX, loomTop);
    ctx.lineTo(loomX, loomBottom);
    ctx.moveTo(w * 0.94, loomTop);
    ctx.lineTo(w * 0.94, loomBottom);
    ctx.moveTo(loomX, loomTop);
    ctx.lineTo(w * 0.94, loomTop);
    ctx.moveTo(loomX, loomBottom * 0.82);
    ctx.lineTo(w * 0.94, loomBottom * 0.82);
    ctx.stroke();

    
    for (const thread of state.threads) {
      const sway = Math.sin(time * 0.35 + thread.phase) * 2.4;
      ctx.strokeStyle = ["rgba(209, 151, 91, 0.3)", "rgba(128, 73, 48, 0.34)",
        "rgba(87, 104, 92, 0.26)", "rgba(226, 193, 142, 0.2)"][thread.hue];
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(thread.x + sway, loomTop + 8);
      ctx.lineTo(thread.x + sway, loomTop + thread.length);
      ctx.stroke();
    }

    
    const fabrics = [
      { x: 0.68, y: 0.2, width: 0.1, height: 0.28, color: "rgba(146, 78, 48, 0.5)" },
      { x: 0.8, y: 0.32, width: 0.08, height: 0.34, color: "rgba(190, 142, 83, 0.4)" },
      { x: 0.88, y: 0.18, width: 0.05, height: 0.24, color: "rgba(92, 77, 69, 0.5)" },
    ];
    for (const fabric of fabrics) {
      const sway = Math.sin(time * 0.5 + fabric.x * 10) * 2;
      ctx.fillStyle = fabric.color;
      ctx.fillRect(w * fabric.x + sway, h * fabric.y, w * fabric.width, h * fabric.height);
      ctx.strokeStyle = "rgba(246, 239, 230, 0.08)";
      ctx.strokeRect(w * fabric.x + sway, h * fabric.y, w * fabric.width, h * fabric.height);
    }

    drawDust(time, 0.7);
  }

  function drawAdobe(time) {
    drawSky();
    drawAdobeTexture();
    const w = state.width;
    const h = state.height;
    const px = state.pointerX * 8;

    
    ctx.fillStyle = "rgba(238, 189, 118, 0.12)";
    ctx.fillRect(w * 0.62 + px, h * 0.04, w * 0.22, h * 0.42);

    
    ctx.strokeStyle = "rgba(55, 39, 28, 0.8)";
    ctx.lineWidth = 2;
    for (const y of [0.48, 0.76]) {
      ctx.beginPath();
      ctx.moveTo(w * 0.06, h * y);
      ctx.lineTo(w * 0.94, h * y);
      ctx.stroke();
    }
    const pots = [
      [0.1, 0.36, 0.07, 0.13], [0.22, 0.34, 0.09, 0.15], [0.35, 0.37, 0.06, 0.12],
      [0.56, 0.64, 0.08, 0.12], [0.72, 0.61, 0.11, 0.16], [0.86, 0.65, 0.06, 0.11],
    ];
    for (const [x, y, width, height] of pots) {
      const sway = Math.sin(time * 0.25 + x * 10) * 0.5;
      ctx.fillStyle = "rgba(155, 91, 55, 0.65)";
      ctx.beginPath();
      ctx.ellipse(w * x + sway, h * y, w * width, h * height * 0.5, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(226, 174, 116, 0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    
    ctx.fillStyle = "rgba(220, 196, 157, 0.2)";
    ctx.fillRect(w * 0.12, h * 0.79, w * 0.22, h * 0.08);
    ctx.fillStyle = "rgba(236, 216, 181, 0.1)";
    ctx.fillRect(w * 0.14, h * 0.8, w * 0.18, h * 0.06);
    drawDust(time, 0.55);
  }

  function drawMilpa(time) {
    const w = state.width;
    const h = state.height;
    const px = state.pointerX * 12;

    
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#2a2018");
    sky.addColorStop(0.48, "#6f4a2b");
    sky.addColorStop(0.72, "#a87643");
    sky.addColorStop(1, "#1b2418");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(28, 36, 27, 0.75)";
    ctx.beginPath();
    ctx.moveTo(0, h * 0.62);
    ctx.lineTo(w * 0.16, h * 0.44);
    ctx.lineTo(w * 0.32, h * 0.58);
    ctx.lineTo(w * 0.52, h * 0.36);
    ctx.lineTo(w * 0.72, h * 0.56);
    ctx.lineTo(w * 0.88, h * 0.4);
    ctx.lineTo(w, h * 0.54);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    
    const sun = ctx.createRadialGradient(w * 0.72 + px, h * 0.3, 4, w * 0.72 + px, h * 0.3, w * 0.22);
    sun.addColorStop(0, "rgba(246, 205, 142, 0.22)");
    sun.addColorStop(1, "rgba(246, 205, 142, 0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);

    
    for (const stalk of state.stalks) {
      const sway = Math.sin(time * 0.55 + stalk.phase) * 3 + stalk.lean * 20;
      const baseX = stalk.x * w + px * 0.35;
      const topY = h - stalk.height;
      ctx.strokeStyle = "rgba(63, 82, 46, 0.9)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(baseX, h);
      ctx.quadraticCurveTo(baseX + sway, h - stalk.height * 0.55, baseX + sway * 1.5, topY);
      ctx.stroke();
      for (let leaf = 0; leaf < stalk.leaves; leaf += 1) {
        const ly = h - stalk.height * (0.25 + leaf * 0.16);
        const side = leaf % 2 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(baseX + sway * 0.6, ly);
        ctx.quadraticCurveTo(baseX + side * 16 + sway, ly - 14,
          baseX + side * 26 + sway * 1.4, ly - 6);
        ctx.strokeStyle = "rgba(88, 108, 58, 0.55)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }
    drawDust(time, 0.65);
  }

  function drawDust(time, strength = 1) {
    ctx.save();
    for (const particle of state.dust) {
      const x = particle.x + Math.sin(time * 0.16 + particle.phase) * 9;
      const y = ((particle.y - time * 4 + state.height) % state.height + state.height) % state.height;
      ctx.globalAlpha = particle.alpha * strength;
      ctx.fillStyle = "#f2d7ad";
      ctx.beginPath();
      ctx.arc(x, y, particle.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function draw() {
    if (!state.width || !state.height) return;
    ctx.clearRect(0, 0, state.width, state.height);
    if (variant === "adobe") drawAdobe(state.time);
    else if (variant === "milpa") drawMilpa(state.time);
    else drawWorkshop(state.time);
  }

  function frame(now) {
    state.raf = requestAnimationFrame(frame);
    if (!state.visible || document.hidden) return;
    const dt = state.last ? Math.min(0.04, (now - state.last) / 1000) : 0.016;
    state.last = now;
    state.time += dt;
    draw();
  }

  const start = () => {
    if (reduced || state.raf) return;
    state.last = 0;
    state.raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
  };
  const onVisibility = () => {
    if (document.hidden) stop();
    else start();
  };
  const onResize = () => {
    resize();
    if (reduced) draw();
  };
  const onPointer = (event) => {
    const rect = wrap.getBoundingClientRect();
    state.pointerX = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1) * 0.5;
    state.pointerY = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1) * 0.5;
  };

  const observer = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        state.visible = entries.some((entry) => entry.isIntersecting);
        if (state.visible) start();
        else stop();
      }, { threshold: 0.02 })
    : null;
  const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(onResize) : null;

  section.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  observer?.observe(section);
  resizeObserver?.observe(wrap);
  resize();
  requestAnimationFrame(onResize);
  if (reduced) draw();
  else start();

  return () => {
    stop();
    observer?.disconnect();
    resizeObserver?.disconnect();
    section.removeEventListener("pointermove", onPointer);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    wrap.remove();
  };
}
