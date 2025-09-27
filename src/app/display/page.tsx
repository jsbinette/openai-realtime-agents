"use client";
import Script from "next/script";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import Head from "next/head";
import { io } from "socket.io-client";

type BackgroundConfig = {
  hue: number;
  saturation: number;
  value: number;
  speed: number;
  strength: number;
};

type VisibilityConfig = {
  text: boolean;
  image: boolean;
  ticker: boolean;
};

const DEFAULT_BACKGROUND: BackgroundConfig = {
  hue: 120,
  saturation: 0.9,
  value: 0.6,
  speed: 0.15,
  strength: 0.35,
};

const HIDE_DELAY = 3000;

export default function DisplayPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlPanelRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const tickerRef = useRef<HTMLDivElement>(null);

  const hideUiTimerRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const glProgramRef = useRef<{
    gl: WebGLRenderingContext;
    uniforms: {
      uRes: WebGLUniformLocation;
      uTime: WebGLUniformLocation;
      uHue: WebGLUniformLocation;
      uSat: WebGLUniformLocation;
      uVal: WebGLUniformLocation;
      uSpeed: WebGLUniformLocation;
      uStrength: WebGLUniformLocation;
    };
    program: WebGLProgram;
    buffer: WebGLBuffer;
    vertexShader: WebGLShader;
    fragmentShader: WebGLShader;
  } | null>(null);

  const [backgroundConfig, setBackgroundConfig] = useState<BackgroundConfig>(DEFAULT_BACKGROUND);
  const backgroundConfigRef = useRef(backgroundConfig);
  useEffect(() => {
    backgroundConfigRef.current = backgroundConfig;
  }, [backgroundConfig]);

  const [visibility, setVisibility] = useState<VisibilityConfig>({
    text: true,
    image: true,
    ticker: true,
  });
  const visibilityRef = useRef(visibility);
  useEffect(() => {
    visibilityRef.current = visibility;
  }, [visibility]);

  const applyVisibility = useCallback(() => {
    const textEl = textRef.current;
    const imgEl = imageRef.current;
    const tickerEl = tickerRef.current;
    if (!textEl || !imgEl || !tickerEl) return;

    textEl.style.display = visibilityRef.current.text ? "block" : "none";
    const hasImage = Boolean(imgEl.getAttribute("src"));
    imgEl.style.display = visibilityRef.current.image && hasImage ? "block" : "none";
    const tickerActive = tickerEl.classList.contains("scrolling") && !!tickerEl.textContent;
    tickerEl.style.display = visibilityRef.current.ticker && tickerActive ? "block" : "none";
  }, []);

  const applyBackground = useCallback((partial: Partial<BackgroundConfig>) => {
    setBackgroundConfig((prev) => {
      const next = { ...prev, ...partial };
      backgroundConfigRef.current = next;
      return next;
    });
    const panel = controlPanelRef.current;
    if (panel) {
      panel.classList.add("visible");
    }
  }, []);

  const sanitizeBackgroundPayload = useCallback((payload: unknown): Partial<BackgroundConfig> | null => {
    if (!payload || typeof payload !== "object") return null;
    const maybeConfig = payload as Record<string, unknown>;
    const next: Partial<BackgroundConfig> = {};
    if (typeof maybeConfig.hue === "number") next.hue = maybeConfig.hue;
    if (typeof maybeConfig.saturation === "number") next.saturation = maybeConfig.saturation;
    if (typeof maybeConfig.value === "number") next.value = maybeConfig.value;
    if (typeof maybeConfig.speed === "number") next.speed = maybeConfig.speed;
    if (typeof maybeConfig.strength === "number") next.strength = maybeConfig.strength;
    return Object.keys(next).length ? next : null;
  }, []);

  useEffect(() => {
    const panel = controlPanelRef.current;
    if (!panel) return;

    const showUi = () => {
      panel.classList.add("visible");
      if (hideUiTimerRef.current) window.clearTimeout(hideUiTimerRef.current);
      hideUiTimerRef.current = window.setTimeout(() => {
        panel.classList.remove("visible");
        hideUiTimerRef.current = null;
      }, HIDE_DELAY);
    };

    const resetTimer = () => showUi();

    showUi();

    const events: Array<[keyof WindowEventMap, EventListener]> = [
      ["mousemove", resetTimer],
      ["mousedown", resetTimer],
      ["touchstart", resetTimer],
      ["touchmove", resetTimer],
      ["keydown", resetTimer],
      ["focusin", resetTimer],
    ];

    events.forEach(([event, handler]) => window.addEventListener(event, handler));

    return () => {
      events.forEach(([event, handler]) => window.removeEventListener(event, handler));
      if (hideUiTimerRef.current) {
        window.clearTimeout(hideUiTimerRef.current);
        hideUiTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    document.body.classList.add("display");

    const textEl = textRef.current;
    const imgEl = imageRef.current;
    const tickerEl = tickerRef.current;

    if (!textEl || !imgEl || !tickerEl) return () => undefined;

    const socket = io("/", { path: "/api/socket" });

    const renderMath = () => {
      try {
        const renderMathInElement = (
          window as typeof window & {
            renderMathInElement?: (element: HTMLElement, options: unknown) => void;
          }
        ).renderMathInElement;

        if (typeof renderMathInElement === "function") {
          renderMathInElement(textEl, {
            delimiters: [
              { left: "$$", right: "$$", display: true },
              { left: "$", right: "$", display: false },
            ],
          });
        }
      } catch {
        // ignore
      }
    };

    const showText = (content: string, size = "medium") => {
      imgEl.classList.remove("fade");
      imgEl.style.display = "none";
      textEl.style.display = "block";
      textEl.className = `${size} fade`;

      let parsed: unknown = null;
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = null;
      }

      if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
        textEl.innerHTML = `<ul>${parsed.map((line) => `<li>${line}</li>`).join("")}</ul>`;
      } else if (typeof content === "string" && content.includes("\n")) {
        const lines = content
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        textEl.innerHTML = `<ul>${lines.map((line) => `<li>${line}</li>`).join("")}</ul>`;
      } else {
        textEl.textContent = content;
      }

      setTimeout(renderMath, 0);
      applyVisibility();
    };

    const showImage = (url: string) => {
      textEl.className = textEl.className.replace(/fade/g, "").trim();
      textEl.style.display = "none";
      imgEl.src = url;
      imgEl.className = "fade";
      imgEl.style.display = "block";
      applyVisibility();
    };

    const setTicker = (text?: string) => {
      if (!text) {
        tickerEl.textContent = "";
        tickerEl.classList.remove("scrolling");
      } else {
        tickerEl.textContent = text;
        tickerEl.classList.add("scrolling");
      }
      applyVisibility();
    };

    const showBackgroundFromSocket = (payload: unknown) => {
      if (typeof payload === "string") {
        try {
          const parsed = JSON.parse(payload);
          const next = sanitizeBackgroundPayload(parsed);
          if (next) applyBackground(next);
          return;
        } catch {
          // ignore invalid JSON
        }
      }
      const next = sanitizeBackgroundPayload(payload);
      if (next) applyBackground(next);
    };

    socket.on("push", (msg: any) => {
      const { kind, content, size, ticker: tk } = msg;
      if (kind === "text" || kind === "math") showText(content, size);
      else if (kind === "image") showImage(content);
      else if (kind === "background") showBackgroundFromSocket(content);
      if (typeof tk !== "undefined") setTicker(tk);
    });

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "1") textEl.className = "tiny";
      if (k === "2") textEl.className = "small";
      if (k === "3") textEl.className = "medium";
      if (k === "4") textEl.className = "large";
      if (k === "5") textEl.className = "huge";
      if (k === "c") {
        showText("", "medium");
        setTicker("");
      }
      if (k === "b") {
        document.body.style.background = "#000";
        document.body.style.color = "#fff";
      }
      if (k === "w") {
        document.body.style.background = "#fff";
        document.body.style.color = "#000";
      }
      if (k === "t") {
        const next = prompt("Ticker text (leave blank to clear):", "");
        setTicker(next || "");
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.classList.remove("display");
      window.removeEventListener("keydown", onKeyDown);
      socket.disconnect();
    };
  }, [applyBackground, applyVisibility, sanitizeBackgroundPayload]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      antialias: false,
      depth: false,
      stencil: false,
      alpha: false,
      preserveDrawingBuffer: true,
    });

    if (!gl) {
      console.warn("WebGL not supported in this browser");
      return;
    }

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Failed to create shader");
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader) || "Unknown shader error";
        gl.deleteShader(shader);
        throw new Error(info);
      }
      return shader;
    };

    const vert = `
      attribute vec2 pos; varying vec2 vUv;
      void main(){ vUv=(pos+1.0)*0.5; gl_Position=vec4(pos,0.,1.); }
    `;

    const frag = `
      precision highp float;
      varying vec2 vUv;
      uniform vec2  uRes;
      uniform float uTime, uHue, uSat, uVal, uSpeed, uStrength;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
      float noise(vec2 p){
        vec2 i=floor(p), f=fract(p);
        float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
        vec2 u=f*f*(3.0-2.0*f);
        return mix(a,b,u.x)+ (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
      }
      float fbm(vec2 p){
        float s=0., a=0.5;
        for(int i=0;i<5;i++){ s += a*noise(p); p*=2.02; a*=0.5; }
        return s;
      }
      vec3 hsv2rgb(vec3 c){
        vec4 K=vec4(1.,2./3.,1./3.,3.);
        vec3 p=abs(fract(vec3(c.x)+K.xyz)*6.-K.www);
        return c.z * mix(K.xxx, clamp(p-K.xxx,0.,1.), c.y);
      }

      void main(){
        vec2 uv = (vUv - 0.5) * vec2(uRes.x/uRes.y, 1.0);
        float t = uTime * uSpeed;
        vec2 q = uv * 0.6;
        vec2 r = vec2(fbm(q + vec2(0.0, t)), fbm(q + vec2(5.2, -t)));
        float n = fbm(uv*1.2 + 2.5*r + vec2(t*0.2, -t*0.15));
        float m = smoothstep(0.2, 0.8, n);
        float tex = mix(0.0, m, uStrength);
        float hue = uHue/360.0;
        float sat = uSat;
        float val = clamp(uVal + tex*0.25, 0.0, 1.0);
        vec3 col = hsv2rgb(vec3(hue, sat, val));
        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const vertexShader = compile(gl.VERTEX_SHADER, vert);
    const fragmentShader = compile(gl.FRAGMENT_SHADER, frag);
    const program = gl.createProgram();
    if (!program) throw new Error("Failed to create program");

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program) || "Unknown program error";
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      throw new Error(info);
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    if (!buffer) throw new Error("Failed to create buffer");
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, "pos");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const getUniform = (name: string) => {
      const location = gl.getUniformLocation(program, name);
      if (!location) throw new Error(`Missing background uniform: ${name}`);
      return location;
    };

    const uniforms = {
      uRes: getUniform("uRes"),
      uTime: getUniform("uTime"),
      uHue: getUniform("uHue"),
      uSat: getUniform("uSat"),
      uVal: getUniform("uVal"),
      uSpeed: getUniform("uSpeed"),
      uStrength: getUniform("uStrength"),
    };

    const size = () => {
      const { innerWidth, innerHeight } = window;
      canvas.width = innerWidth;
      canvas.height = innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    size();
    const onResize = () => size();
    window.addEventListener("resize", onResize);

    startTimeRef.current = performance.now();

    const frame = (now: number) => {
      animationFrameRef.current = window.requestAnimationFrame(frame);
      gl.uniform2f(uniforms.uRes, canvas.width, canvas.height);
      gl.uniform1f(uniforms.uTime, (now - startTimeRef.current) / 1000);
      const config = backgroundConfigRef.current;
      gl.uniform1f(uniforms.uHue, config.hue);
      gl.uniform1f(uniforms.uSat, config.saturation);
      gl.uniform1f(uniforms.uVal, config.value);
      gl.uniform1f(uniforms.uSpeed, config.speed);
      gl.uniform1f(uniforms.uStrength, config.strength);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    animationFrameRef.current = window.requestAnimationFrame(frame);

    glProgramRef.current = {
      gl,
      uniforms,
      program,
      buffer,
      vertexShader,
      fragmentShader,
    };

    return () => {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      window.removeEventListener("resize", onResize);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      glProgramRef.current = null;
    };
  }, []);

  useEffect(() => {
    applyVisibility();
  }, [visibility, applyVisibility]);

  const handleBackgroundChange = (key: keyof BackgroundConfig) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    if (Number.isFinite(value)) {
      applyBackground({ [key]: value } as Partial<BackgroundConfig>);
    }
  };

  const handleVisibilityToggle = (key: keyof VisibilityConfig) => (event: ChangeEvent<HTMLInputElement>) => {
    setVisibility((prev) => ({ ...prev, [key]: event.target.checked }));
  };

  return (
    <>
      <Head>
        <title>Projector Display</title>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/static/styles.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" />
      </Head>
      <Script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js" strategy="afterInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js" strategy="afterInteractive" />
      <canvas ref={canvasRef} className="background-canvas" />
      <div id="stage">
        <div id="box">
          <div id="text" ref={textRef} className="medium fade"></div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img id="img" ref={imageRef} alt="" />
        </div>
      </div>
      <div id="ticker" ref={tickerRef}></div>
      <div ref={controlPanelRef} className="display-ui">
        <fieldset>
          <legend>Background</legend>
          <label>
            Hue (°)
            <input type="range" min="0" max="360" value={backgroundConfig.hue} onChange={handleBackgroundChange("hue")} />
          </label>
          <label>
            Saturation
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={backgroundConfig.saturation}
              onChange={handleBackgroundChange("saturation")}
            />
          </label>
          <label>
            Brightness
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={backgroundConfig.value}
              onChange={handleBackgroundChange("value")}
            />
          </label>
          <label>
            Motion speed
            <input
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={backgroundConfig.speed}
              onChange={handleBackgroundChange("speed")}
            />
          </label>
          <label>
            Texture strength
            <input
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={backgroundConfig.strength}
              onChange={handleBackgroundChange("strength")}
            />
          </label>
        </fieldset>
        <fieldset>
          <legend>Visibility</legend>
          <label>
            <input type="checkbox" checked={visibility.text} onChange={handleVisibilityToggle("text")} /> Text
          </label>
          <label>
            <input type="checkbox" checked={visibility.image} onChange={handleVisibilityToggle("image")} /> Image
          </label>
          <label>
            <input type="checkbox" checked={visibility.ticker} onChange={handleVisibilityToggle("ticker")} /> Ticker
          </label>
        </fieldset>
      </div>
    </>
  );
}
