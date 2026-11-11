import type * as FaceApiNs from "@vladmandic/face-api/dist/face-api.esm.js";

export type FaceApi = typeof FaceApiNs;
export type Point = { x: number; y: number };

const MODEL_URL = "/models";
const MODEL_COUNT = 5;

/** Estado de preparación compartido, para mostrar progreso en la pantalla de carga. */
export type AiStatus = { models: number; modelsTotal: number; warm: number; warmTotal: number; ready: boolean };
let status: AiStatus = { models: 0, modelsTotal: MODEL_COUNT, warm: 0, warmTotal: 4, ready: false };
const listeners = new Set<(s: AiStatus) => void>();
function setStatus(patch: Partial<AiStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l(status));
}
export function subscribeAiStatus(listener: (s: AiStatus) => void): () => void {
  listeners.add(listener);
  listener(status);
  return () => listeners.delete(listener);
}

let loader: Promise<FaceApi> | null = null;
let warmer: Promise<void> | null = null;
let markLiveReady: () => void = () => {};
/** Se resuelve cuando ya están listas las redes del análisis en vivo (detector + landmarks). */
const liveReady = new Promise<void>((resolve) => {
  markLiveReady = resolve;
});

/** Carga face-api y sus modelos una sola vez (singleton compartido por toda la app). */
export function loadFaceApi(): Promise<FaceApi> {
  if (!loader) {
    loader = (async () => {
      const faceapi = await import("@vladmandic/face-api/dist/face-api.esm.js");
      // Los tipos de face-api no exponen la API completa de tfjs que sí trae el bundle.
      const tf = faceapi.tf as unknown as {
        setBackend(name: string): Promise<boolean>;
        ready(): Promise<void>;
        env(): { set(flag: string, value: unknown): void };
      };
      try {
        // Shaders independientes del tamaño de la entrada: muchas menos compilaciones en móviles.
        tf.env().set("WEBGL_USE_SHAPES_UNIFORMS", true);
      } catch {
        /* flag no disponible */
      }
      const ok = await tf.setBackend("webgl").catch(() => false);
      if (!ok) await tf.setBackend("cpu");
      await tf.ready();
      let loaded = 0;
      const track = (p: Promise<void>) =>
        p.then(() => setStatus({ models: ++loaded }));
      await Promise.all([
        track(faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)),
        track(faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)),
        track(faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)),
        track(faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL)),
        track(faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)),
      ]);
      return faceapi;
    })();
    loader.catch(() => {
      loader = null;
      setStatus({ models: 0 });
    });
  }
  return loader;
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * La primera inferencia de cada red compila sus shaders WebGL y congela la UI un momento.
 * Las "calentamos" una a una, cediendo el hilo entre cada paso, empezando por las que
 * se usan en vivo (detector + landmarks) para que la cámara responda cuanto antes.
 */
export function warmFaceApi(): Promise<void> {
  if (!warmer) {
    warmer = (async () => {
      const faceapi = await loadFaceApi();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 160;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#888";
      ctx.fillRect(0, 0, 160, 160);
      const steps = [
        () => faceapi.detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 288 })).run(),
        () => faceapi.nets.faceLandmark68Net.detectLandmarks(canvas),
        () => faceapi.nets.faceExpressionNet.predictExpressions(canvas),
        async () => {
          await faceapi.detectSingleFace(canvas, new faceapi.SsdMobilenetv1Options()).run();
          await pause(50);
          await faceapi.nets.faceRecognitionNet.computeFaceDescriptor(canvas);
        },
      ];
      for (let i = 0; i < steps.length; i++) {
        try {
          await steps[i]();
        } catch {
          /* el calentamiento es opcional */
        }
        setStatus({ warm: i + 1 });
        if (i === 1) markLiveReady();
        await pause(50);
      }
      markLiveReady();
      setStatus({ ready: true });
    })();
  }
  return warmer;
}

/** Inicia en segundo plano la descarga y preparación de la IA (al entrar a la página). */
export function preloadFaceApi() {
  loadFaceApi()
    .then(() => warmFaceApi())
    .catch(() => {});
}

export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Lo que espera la pantalla de carga: modelos descargados (máx. `loadMs`) y, como mucho
 * `warmMs` adicionales, el calentamiento de la parte en vivo. El resto termina en segundo plano.
 */
export async function prepareFaceApi(loadMs = 40_000, warmMs = 4_000): Promise<FaceApi | null> {
  const faceapi = await withTimeout(
    loadFaceApi().catch(() => null),
    loadMs,
  );
  if (!faceapi) return null;
  warmFaceApi();
  await withTimeout(liveReady, warmMs);
  return faceapi;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Eye Aspect Ratio: cae bruscamente cuando el ojo se cierra. */
export function eyeAspectRatio(eye: Point[]): number {
  const [p0, p1, p2, p3, p4, p5] = eye;
  return (dist(p1, p5) + dist(p2, p4)) / (2 * dist(p0, p3));
}

export type DescribedFace = {
  descriptor: Float32Array;
  score: number;
  box: { x: number; y: number; width: number; height: number };
};

/**
 * Detecta un rostro y calcula su descriptor probando varios detectores en cascada.
 * SSD MobileNet falla en muchas GPUs móviles (texturas de 16 bits) aunque el TinyFaceDetector
 * sí funcione, así que nunca dependemos de un único detector. También descartamos
 * descriptores inválidos (NaN) que esas GPUs pueden producir.
 */
export async function describeFace(
  faceapi: FaceApi,
  input: HTMLCanvasElement,
  mode: "document" | "selfie",
): Promise<DescribedFace | null> {
  const detectors =
    mode === "document"
      ? [
          new faceapi.TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.3 }),
          new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.25 }),
          new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }),
          new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.2 }),
        ]
      : [
          new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 }),
          new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }),
          new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }),
        ];
  for (const options of detectors) {
    try {
      const r = await faceapi.detectSingleFace(input, options).withFaceLandmarks().withFaceDescriptor().run();
      if (r && r.descriptor.every(Number.isFinite)) {
        const { x, y, width, height } = r.detection.box;
        return { descriptor: r.descriptor, score: r.detection.score, box: { x, y, width, height } };
      }
    } catch {
      /* probamos con el siguiente detector */
    }
  }
  return null;
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Apertura del ojo medida en los píxeles: un ojo abierto tiene alto contraste (esclerótica
 * clara + iris oscuro); al cerrarse solo queda piel del párpado y el contraste cae.
 * Es mucho más sensible que el EAR, porque la red de landmarks tiende a "dibujar" ojos abiertos.
 */
export function eyeContrast(source: HTMLCanvasElement, eye: Point[], scratch: HTMLCanvasElement): number {
  const xs = eye.map((p) => p.x);
  const ys = eye.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const w = maxX - minX;
  const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
  const sx = minX - w * 0.1;
  const sy = cy - w * 0.32;
  const W = 32;
  const H = 16;
  scratch.width = W;
  scratch.height = H;
  const ctx = scratch.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, sx, sy, w * 1.2, w * 0.64, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);
  let sum = 0;
  let sq = 0;
  const n = W * H;
  for (let i = 0; i < data.length; i += 4) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += g;
    sq += g * g;
  }
  const mean = sum / n;
  return Math.sqrt(Math.max(0, sq / n - mean * mean)) / (mean + 1);
}

/**
 * Estimación de giro horizontal a partir de la nariz respecto a los extremos de los ojos.
 * 0 = de frente. Positivo = la persona gira hacia SU izquierda (en imagen sin espejo).
 */
export function estimateYaw(positions: Point[]): number {
  const leftOuter = positions[36];
  const rightOuter = positions[45];
  const nose = positions[30];
  const ratio = (nose.x - leftOuter.x) / (rightOuter.x - leftOuter.x);
  return (ratio - 0.5) * 2;
}

export type CoverRect = { sx: number; sy: number; sw: number; sh: number };

/** Región del video visible en un contenedor con `object-fit: cover`. */
export function coverRect(vw: number, vh: number, cw: number, ch: number): CoverRect {
  const videoAspect = vw / vh;
  const boxAspect = cw / ch;
  if (videoAspect > boxAspect) {
    const sw = vh * boxAspect;
    return { sx: (vw - sw) / 2, sy: 0, sw, sh: vh };
  }
  const sh = vw / boxAspect;
  return { sx: 0, sy: (vh - sh) / 2, sw: vw, sh };
}

export type ImageQuality = { sharpness: number; brightness: number; glare: number; detail: number };

/**
 * Nitidez (varianza del Laplaciano), brillo medio, porcentaje de píxeles quemados y
 * densidad de bordes (`detail`: alta cuando hay texto/patrones, baja en superficies lisas).
 */
export function analyzeQuality(source: CanvasImageSource, sw: number, sh: number): ImageQuality {
  const w = 360;
  const h = Math.max(1, Math.round((sh / sw) * w));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const gray = new Float32Array(w * h);
  let sum = 0;
  let glare = 0;
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[j] = g;
    sum += g;
    if (g > 248) glare++;
  }
  let lapSum = 0;
  let lapSq = 0;
  let edges = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      lapSum += lap;
      lapSq += lap * lap;
      if (Math.abs(lap) > 24) edges++;
      n++;
    }
  }
  const mean = lapSum / n;
  return {
    sharpness: lapSq / n - mean * mean,
    brightness: sum / (w * h),
    glare: glare / (w * h),
    detail: edges / n,
  };
}

/** Convierte distancia euclidiana entre descriptores en un % de similitud (sigmoide centrada en el umbral). */
export const MATCH_THRESHOLD = 0.55;

export function similarityFromDistance(distance: number): number {
  return 1 / (1 + Math.exp((distance - MATCH_THRESHOLD) * 12));
}

export function euclidean(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

export function cropToDataUrl(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  opts: { maxWidth?: number; mirror?: boolean; quality?: number } = {},
): string {
  const scale = Math.min(1, (opts.maxWidth ?? 900) / sw);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext("2d")!;
  if (opts.mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", opts.quality ?? 0.9);
}
