"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  Camera,
  Check,
  CreditCard,
  FileText,
  Fingerprint,
  Focus,
  Loader2,
  RefreshCw,
  ScanFace,
  Sun,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useCamera } from "@/hooks/useCamera";
import {
  analyzeQuality,
  coverRect,
  describeFace,
  preloadFaceApi,
  prepareFaceApi,
  type FaceApi,
  type ImageQuality,
} from "@/lib/face";
import { PreparingStatus } from "./PreparingStatus";
import { createOcrEngine, parseDocumentText, type DocumentFields, type OcrEngine } from "@/lib/ocr";

export type DocumentCapture = {
  image: string;
  backImage: string;
  face: string;
  descriptor: Float32Array;
  fields: DocumentFields | null;
  quality: ImageQuality;
  faceScore: number;
};

type Side = "front" | "back";
type Phase = "intro" | "loading" | "scanning" | "checking" | "flip" | "reading" | "review" | "error";
type Checks = { primary: boolean; focus: boolean; light: boolean; glare: boolean };

type FrontData = Pick<DocumentCapture, "image" | "face" | "descriptor" | "quality" | "faceScore">;

const CARD_RATIO = 85.6 / 54;
const SHARPNESS_MIN = 40;
const DETAIL_MIN = 0.04;
const STABLE_FRAMES = 4;

const SIDE_COPY: Record<Side, { label: string; primary: string; PrimaryIcon: LucideIcon; place: string }> = {
  front: {
    label: "Frente",
    primary: "Foto del titular",
    PrimaryIcon: ScanFace,
    place: "Ubica el frente de la cédula (lado con tu foto) dentro del marco",
  },
  back: {
    label: "Reverso",
    primary: "Reverso detectado",
    PrimaryIcon: Fingerprint,
    place: "Ubica el reverso de la cédula (lado con la huella) dentro del marco",
  },
};

const QUALITY_ITEMS: { key: Exclude<keyof Checks, "primary">; label: string; Icon: LucideIcon }[] = [
  { key: "focus", label: "Enfoque", Icon: Focus },
  { key: "light", label: "Iluminación", Icon: Sun },
  { key: "glare", label: "Sin reflejos", Icon: Sparkles },
];

const EMPTY_CHECKS: Checks = { primary: false, focus: false, light: false, glare: false };

async function safe<T>(task: { run(): Promise<T> }): Promise<T | undefined> {
  try {
    return await task.run();
  } catch {
    return undefined;
  }
}

export default function DocumentScanner({
  onComplete,
  readText = true,
}: {
  onComplete: (capture: DocumentCapture) => void;
  readText?: boolean;
}) {
  const { videoRef, status: cameraStatus, start: startCamera, stop: stopCamera } = useCamera("environment");
  const containerRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const runningRef = useRef(false);
  const stableRef = useRef(0);
  const sideRef = useRef<Side>("front");
  const faceapiRef = useRef<FaceApi | null>(null);
  const frontFailsRef = useRef(0);
  const ocrRef = useRef<OcrEngine | null>(null);
  const frontRef = useRef<FrontData | null>(null);
  const frontTextRef = useRef<Promise<string>>(Promise.resolve(""));
  const skipRef = useRef<(() => void) | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase, setPhase] = useState<Phase>("intro");
  const [side, setSide] = useState<Side>("front");
  const [checks, setChecks] = useState<Checks>(EMPTY_CHECKS);
  const [hint, setHint] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stable, setStable] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrDone, setOcrDone] = useState(0);
  const [frontFace, setFrontFace] = useState<string | null>(null);
  const [result, setResult] = useState<DocumentCapture | null>(null);
  const [flash, setFlash] = useState(false);

  // La IA empieza a descargarse y prepararse apenas se abre la página.
  useEffect(() => preloadFaceApi(), []);

  useEffect(
    () => () => {
      runningRef.current = false;
      ocrRef.current?.terminate();
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  async function ensureModels() {
    if (faceapiRef.current) return faceapiRef.current;
    const faceapi = await prepareFaceApi();
    faceapiRef.current = faceapi;
    return faceapi;
  }

  function fail(text: string) {
    runningRef.current = false;
    stopCamera();
    setError(text);
    setPhase("error");
  }

  function showNotice(text: string) {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  }

  function startScanning(next: Side) {
    sideRef.current = next;
    setSide(next);
    setChecks(EMPTY_CHECKS);
    setHint(null);
    stableRef.current = 0;
    setStable(0);
    setPhase("scanning");
    runningRef.current = true;
    loop();
  }

  async function begin() {
    setError(null);
    setResult(null);
    setFrontFace(null);
    setOcrProgress(0);
    setOcrDone(0);
    frontRef.current = null;
    frontTextRef.current = Promise.resolve("");
    ocrRef.current?.terminate();
    // El OCR se descarga en segundo plano mientras la persona ubica el documento.
    ocrRef.current = readText ? createOcrEngine(setOcrProgress) : null;

    setPhase("loading");
    const [faceapi, camError] = await Promise.all([ensureModels(), startCamera()]);
    if (camError) return fail(camError);
    if (!faceapi) return fail("La preparación de la IA está tardando demasiado. Revisa tu conexión y vuelve a intentarlo.");
    startScanning("front");
  }

  /** Recorta del video la región que coincide con el marco guía. */
  function cropGuide(video: HTMLVideoElement, maxWidth: number): HTMLCanvasElement | null {
    const container = containerRef.current;
    const guide = guideRef.current;
    if (!container || !guide || !video.videoWidth) return null;
    const cr = container.getBoundingClientRect();
    const gr = guide.getBoundingClientRect();
    const c = coverRect(video.videoWidth, video.videoHeight, cr.width, cr.height);
    const margin = 0.04;
    const u0 = (gr.left - cr.left) / cr.width - margin;
    const v0 = (gr.top - cr.top) / cr.height - margin;
    const u1 = (gr.right - cr.left) / cr.width + margin;
    const v1 = (gr.bottom - cr.top) / cr.height + margin;
    const sx = Math.max(0, c.sx + u0 * c.sw);
    const sy = Math.max(0, c.sy + v0 * c.sh);
    const sw = Math.min(video.videoWidth - sx, (u1 - u0) * c.sw);
    const sh = Math.min(video.videoHeight - sy, (v1 - v0) * c.sh);
    const scale = Math.min(1, maxWidth / sw);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    canvas.getContext("2d")!.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  async function loop() {
    const faceapi = faceapiRef.current;
    const video = videoRef.current;
    if (!runningRef.current || !faceapi || !video) return;
    // Para el análisis en vivo basta una versión reducida: mantiene fluida la interfaz.
    const crop = video.readyState >= 2 ? cropGuide(video, 640) : null;
    if (crop) {
      const q = analyzeQuality(crop, crop.width, crop.height);
      const det = await safe(
        faceapi.detectSingleFace(crop, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 })),
      );
      if (!runningRef.current) return;
      const isFront = sideRef.current === "front";
      const faceVisible = !!det && det.score > 0.6;
      const next: Checks = {
        primary: isFront ? !!det : !faceVisible && q.detail > DETAIL_MIN,
        focus: q.sharpness > SHARPNESS_MIN,
        light: q.brightness > 55 && q.brightness < 225,
        glare: q.glare < 0.04,
      };
      setChecks(next);
      setHint(!isFront && faceVisible ? "Ese es el frente. Voltea la cédula para mostrar el reverso" : null);
      const ok = Object.values(next).every(Boolean);
      stableRef.current = ok ? stableRef.current + 1 : 0;
      setStable(stableRef.current);
      if (stableRef.current >= STABLE_FRAMES) {
        capture();
        return;
      }
    }
    setTimeout(loop, 160);
  }

  async function capture() {
    const video = videoRef.current;
    const crop = video ? cropGuide(video, 1600) : null;
    if (!crop) return;
    runningRef.current = false;
    setFlash(true);
    setTimeout(() => setFlash(false), 250);
    if (sideRef.current === "front") await handleFront(crop);
    else await handleBack(crop);
  }

  async function handleFront(crop: HTMLCanvasElement) {
    setPhase("checking");
    const faceapi = await ensureModels();
    if (!faceapi) return fail("No pudimos cargar los modelos de IA.");

    // La foto de la cédula es pequeña: ampliamos la imagen si hace falta.
    const scale = crop.width < 1100 ? 1100 / crop.width : 1;
    const work = document.createElement("canvas");
    work.width = Math.round(crop.width * scale);
    work.height = Math.round(crop.height * scale);
    const wctx = work.getContext("2d")!;
    wctx.imageSmoothingQuality = "high";
    wctx.drawImage(crop, 0, 0, work.width, work.height);

    // Probamos en la imagen ampliada y, si no, en la original.
    let source = work;
    let det = await describeFace(faceapi, work, "document");
    if (!det) {
      source = crop;
      det = await describeFace(faceapi, crop, "document");
    }

    if (!det) {
      frontFailsRef.current++;
      showNotice(
        frontFailsRef.current >= 2
          ? "Seguimos sin ver bien la foto. Acerca la cédula para que llene el marco y evita reflejos sobre la foto."
          : "No pudimos leer la foto del titular. Mantén la cédula quieta, sin reflejos, e inténtalo de nuevo.",
      );
      startScanning("front");
      return;
    }
    frontFailsRef.current = 0;

    const b = det.box;
    const pad = 0.35;
    const fx = Math.max(0, b.x - b.width * pad);
    const fy = Math.max(0, b.y - b.height * pad);
    const fw = Math.min(source.width - fx, b.width * (1 + 2 * pad));
    const fh = Math.min(source.height - fy, b.height * (1 + 2 * pad));
    const faceCanvas = document.createElement("canvas");
    faceCanvas.width = 320;
    faceCanvas.height = Math.round((fh / fw) * 320);
    faceCanvas.getContext("2d")!.drawImage(source, fx, fy, fw, fh, 0, 0, faceCanvas.width, faceCanvas.height);
    const face = faceCanvas.toDataURL("image/jpeg", 0.92);

    frontRef.current = {
      image: crop.toDataURL("image/jpeg", 0.9),
      face,
      descriptor: det.descriptor,
      quality: analyzeQuality(crop, crop.width, crop.height),
      faceScore: det.score,
    };
    setFrontFace(face);

    // Leemos el frente mientras la persona voltea y escanea el reverso.
    const engine = ocrRef.current;
    if (engine) {
      frontTextRef.current = engine
        .recognize(crop)
        .catch(() => "")
        .finally(() => setOcrDone((n) => n + 1));
    }

    setPhase("flip");
    setTimeout(() => startScanning("back"), 2400);
  }

  async function handleBack(crop: HTMLCanvasElement) {
    stopCamera();
    const front = frontRef.current;
    if (!front) return fail("Ocurrió un error con la captura del frente. Vuelve a intentarlo.");
    const backImage = crop.toDataURL("image/jpeg", 0.9);

    let fields: DocumentFields | null = null;
    const engine = ocrRef.current;
    if (engine) {
      setPhase("reading");
      const skip = new Promise<null>((resolve) => {
        skipRef.current = () => resolve(null);
      });
      const texts = Promise.all([frontTextRef.current, engine.recognize(crop).catch(() => "")]);
      const outcome = await Promise.race([texts, skip]);
      skipRef.current = null;
      engine.terminate();
      ocrRef.current = null;
      fields = outcome ? parseDocumentText(outcome[0], outcome[1]) : null;
    }

    setResult({ ...front, backImage, fields });
    setPhase("review");
  }

  const scanning = phase === "scanning";
  const allOk = Object.values(checks).every(Boolean);
  const copy = SIDE_COPY[side];
  const message = allOk
    ? "¡Perfecto! Mantén la cédula quieta…"
    : hint ??
      (!checks.primary
        ? copy.place
        : !checks.focus
          ? "Acerca o aleja un poco para enfocar"
          : !checks.light
            ? "Busca un lugar con mejor iluminación"
            : "Inclina la cédula para evitar reflejos");
  const readingPct = Math.round(((ocrDone + ocrProgress) / 2) * 100);

  return (
    <div className="flex w-full flex-col items-center gap-5">
      {phase !== "intro" && phase !== "error" && phase !== "review" && <SideStepper side={side} frontDone={!!frontFace} />}

      <div
        ref={containerRef}
        className="relative aspect-[3/4] w-full max-w-[560px] overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-2xl shadow-cyan-500/5 sm:aspect-[4/3]"
      >
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />

        {/* Marco del documento con máscara */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            ref={guideRef}
            style={{ aspectRatio: CARD_RATIO }}
            className={`relative w-[86%] rounded-2xl shadow-[0_0_0_9999px_rgba(3,6,14,0.72)] ${
              scanning || phase === "checking" ? "" : "opacity-0"
            }`}
          >
            {(["tl", "tr", "bl", "br"] as const).map((corner) => (
              <span
                key={corner}
                className={`absolute h-8 w-8 border-[3px] transition-colors duration-300 ${
                  allOk ? "border-emerald-400" : "border-white/80"
                } ${
                  corner === "tl"
                    ? "left-0 top-0 rounded-tl-2xl border-b-0 border-r-0"
                    : corner === "tr"
                      ? "right-0 top-0 rounded-tr-2xl border-b-0 border-l-0"
                      : corner === "bl"
                        ? "bottom-0 left-0 rounded-bl-2xl border-r-0 border-t-0"
                        : "bottom-0 right-0 rounded-br-2xl border-l-0 border-t-0"
                }`}
              />
            ))}
            {scanning && (
              <>
                <div className="absolute inset-0 overflow-hidden rounded-2xl">
                  <div className="animate-scan absolute inset-x-0 h-14 bg-gradient-to-b from-transparent via-cyan-400/25 to-transparent" />
                </div>
                <CardGuide side={side} />
              </>
            )}
          </div>
        </div>

        {scanning && (
          <div className="absolute inset-x-4 top-4 space-y-2">
            <div className="rounded-2xl bg-slate-900/70 px-4 py-2.5 text-center text-sm font-medium text-white ring-1 ring-white/10 backdrop-blur-md">
              {message}
            </div>
            <AnimatePresence>
              {notice && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl bg-amber-400/15 px-4 py-2 text-center text-xs font-medium text-amber-200 ring-1 ring-amber-300/30 backdrop-blur-md"
                >
                  {notice}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {scanning && (
          <div className="absolute inset-x-4 bottom-4 flex flex-wrap justify-center gap-2">
            <CheckChip ok={checks.primary} label={copy.primary} Icon={copy.PrimaryIcon} />
            {QUALITY_ITEMS.map(({ key, label, Icon }) => (
              <CheckChip key={key} ok={checks[key]} label={label} Icon={Icon} />
            ))}
          </div>
        )}

        <AnimatePresence>
          {flash && <motion.div initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-white" />}
        </AnimatePresence>

        {phase === "checking" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/60 backdrop-blur-[2px]">
            <Loader2 className="h-9 w-9 animate-spin text-cyan-300" />
            <p className="text-sm font-medium text-white">Verificando la foto del titular…</p>
          </div>
        )}

        <AnimatePresence>
          {!scanning && phase !== "checking" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-slate-950/95 p-6 text-center"
            >
              {phase === "intro" && (
                <>
                  <DocIllustration />
                  <div>
                    <h3 className="text-lg font-semibold text-white">Escanea tu cédula por ambos lados</h3>
                    <p className="mx-auto mt-1 max-w-xs text-sm text-slate-400">
                      Primero el frente, donde aparece tu foto, y luego el reverso, donde está tu huella.
                    </p>
                  </div>
                  <button onClick={begin} className="btn-primary">
                    <Camera className="h-4 w-4" /> Activar cámara
                  </button>
                </>
              )}
              {phase === "loading" && (
                <>
                  <p className="font-semibold text-white">Preparando el escáner</p>
                  <PreparingStatus camera={cameraStatus} />
                </>
              )}
              {phase === "flip" && <FlipAnimation face={frontFace} />}
              {phase === "reading" && (
                <div className="w-full max-w-xs space-y-4">
                  <div className="relative mx-auto h-16 w-16">
                    <div className="absolute inset-0 animate-spin rounded-full border-2 border-cyan-400/20 border-t-cyan-400" />
                    <FileText className="absolute inset-0 m-auto h-7 w-7 text-cyan-300" />
                  </div>
                  <p className="font-semibold text-white">Leyendo los datos de la cédula</p>
                  <ul className="space-y-2 text-left text-sm">
                    <ProcessStep done active={false} label="Foto del titular verificada" />
                    <ProcessStep done={ocrDone >= 1} active={ocrDone < 1} label="Datos del frente" />
                    <ProcessStep done={ocrDone >= 2} active={ocrDone >= 1} label="Datos del reverso" />
                  </ul>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                      animate={{ width: `${Math.min(100, readingPct)}%` }}
                    />
                  </div>
                  <button
                    onClick={() => skipRef.current?.()}
                    className="text-xs text-slate-400 underline-offset-4 hover:text-white hover:underline"
                  >
                    Omitir lectura de datos
                  </button>
                </div>
              )}
              {phase === "review" && result && (
                <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }} className="w-full space-y-4">
                  <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
                    {[
                      [result.image, "Frente"],
                      [result.backImage, "Reverso"],
                    ].map(([src, label]) => (
                      <figure key={label} className="space-y-1.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={label} className="w-full rounded-xl ring-1 ring-white/15" />
                        <figcaption className="text-xs text-slate-400">{label}</figcaption>
                      </figure>
                    ))}
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm font-medium text-emerald-300">
                    <Check className="h-4 w-4" /> Cédula capturada por ambos lados
                  </div>
                </motion.div>
              )}
              {phase === "error" && (
                <>
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30">
                    <AlertTriangle className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">No pudimos procesar el documento</p>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">{error}</p>
                  </div>
                  <button onClick={begin} className="btn-primary">
                    <RefreshCw className="h-4 w-4" /> Reintentar
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {scanning && (
        <div className="flex w-full max-w-[560px] flex-col items-center gap-3">
          <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
              animate={{ width: `${(stable / STABLE_FRAMES) * 100}%` }}
            />
          </div>
          <p className="text-xs text-slate-400">La captura es automática cuando todo está en verde</p>
          <button onClick={capture} className="btn-ghost">
            <Camera className="h-4 w-4" /> Capturar {side === "front" ? "frente" : "reverso"} manualmente
          </button>
        </div>
      )}

      {phase === "review" && result && (
        <div className="w-full max-w-[560px] space-y-4">
          <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
            <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
              <p className="mb-2 text-xs uppercase tracking-wider text-slate-400">Rostro detectado</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.face} alt="Rostro del documento" className="w-full rounded-xl" />
            </div>
            <ExtractedFields fields={result.fields} readText={readText} />
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <button onClick={begin} className="btn-ghost">
              <RefreshCw className="h-4 w-4" /> Repetir captura
            </button>
            <button onClick={() => onComplete(result)} className="btn-primary">
              Continuar <Check className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Silueta de referencia: frente con foto a la derecha; reverso con huella a la izquierda. */
function CardGuide({ side }: { side: Side }) {
  const lines = (
    <div className="space-y-2.5">
      <div className="h-2 w-24 rounded-full bg-white/10" />
      <div className="h-2 w-36 rounded-full bg-white/10" />
      <div className="h-2 w-20 rounded-full bg-white/10" />
      <div className="h-2 w-28 rounded-full bg-white/10" />
    </div>
  );
  return side === "front" ? (
    <>
      <div className="absolute left-[7%] top-[26%]">{lines}</div>
      <div className="absolute right-[6%] top-[18%] grid h-[64%] w-[27%] place-items-center rounded-xl border border-dashed border-white/30">
        <ScanFace className="h-8 w-8 text-white/25" />
      </div>
    </>
  ) : (
    <>
      <div className="absolute left-[6%] top-[16%] grid h-[56%] w-[24%] place-items-center rounded-xl border border-dashed border-white/30">
        <Fingerprint className="h-9 w-9 text-white/25" />
      </div>
      <div className="absolute left-[38%] top-[20%]">{lines}</div>
      <div className="absolute bottom-[10%] left-[38%] right-[6%] h-[14%] rounded-md border border-dashed border-white/20 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.12)_0_2px,transparent_2px_5px)]" />
    </>
  );
}

function CheckChip({ ok, label, Icon }: { ok: boolean; label: string; Icon: LucideIcon }) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur-md transition-colors ${
        ok ? "bg-emerald-400/20 text-emerald-200 ring-1 ring-emerald-300/40" : "bg-slate-900/70 text-slate-300 ring-1 ring-white/10"
      }`}
    >
      {ok ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

function SideStepper({ side, frontDone }: { side: Side; frontDone: boolean }) {
  const items: { key: Side; label: string; Icon: LucideIcon; done: boolean }[] = [
    { key: "front", label: "Frente", Icon: ScanFace, done: frontDone },
    { key: "back", label: "Reverso", Icon: Fingerprint, done: false },
  ];
  return (
    <div className="flex w-full max-w-[560px] items-center gap-2">
      {items.map(({ key, label, Icon, done }, i) => {
        const active = side === key && !done;
        return (
          <div key={key} className="flex flex-1 items-center gap-2">
            <div
              className={`flex flex-1 items-center gap-2 rounded-full px-3 py-2 text-xs font-medium ring-1 transition-colors ${
                done
                  ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30"
                  : active
                    ? "bg-white/10 text-white ring-white/25"
                    : "bg-white/[0.03] text-slate-500 ring-white/5"
              }`}
            >
              <span className="grid h-5 w-5 place-items-center">
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </span>
              Lado {i + 1} · {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FlipAnimation({ face }: { face: string | null }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="[perspective:900px]">
        <motion.div
          initial={{ rotateY: 0 }}
          animate={{ rotateY: 180 }}
          transition={{ delay: 0.5, duration: 1.1, ease: "easeInOut" }}
          className="relative h-28 w-44 [transform-style:preserve-3d]"
        >
          {/* Frente: foto a la derecha */}
          <div className="absolute inset-0 flex gap-2 rounded-xl bg-gradient-to-br from-amber-100/90 to-amber-200/80 p-2.5 [backface-visibility:hidden]">
            <div className="flex-1 space-y-1.5 pt-2">
              <div className="h-1.5 w-full rounded bg-slate-700/40" />
              <div className="h-1.5 w-3/4 rounded bg-slate-700/30" />
              <div className="h-1.5 w-1/2 rounded bg-slate-700/30" />
            </div>
            {face ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={face} alt="" className="h-full w-14 rounded-md object-cover" />
            ) : (
              <div className="h-full w-14 rounded-md bg-slate-600/40" />
            )}
          </div>
          {/* Reverso: huella a la izquierda */}
          <div className="absolute inset-0 flex gap-2 rounded-xl bg-gradient-to-br from-amber-100/90 to-amber-200/80 p-2.5 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <div className="grid h-[70%] w-12 place-items-center rounded-md bg-slate-600/20">
              <Fingerprint className="h-7 w-7 text-slate-700/60" />
            </div>
            <div className="flex-1 space-y-1.5 pt-2">
              <div className="h-1.5 w-full rounded bg-slate-700/40" />
              <div className="h-1.5 w-2/3 rounded bg-slate-700/30" />
              <div className="mt-4 h-4 w-full rounded-sm bg-[repeating-linear-gradient(90deg,rgba(30,41,59,0.5)_0_2px,transparent_2px_4px)]" />
            </div>
          </div>
        </motion.div>
      </div>
      <div>
        <p className="flex items-center justify-center gap-2 font-semibold text-emerald-300">
          <Check className="h-5 w-5" /> ¡Frente capturado!
        </p>
        <p className="mt-1 text-lg font-semibold text-white">Ahora voltea tu cédula</p>
        <p className="mt-1 text-sm text-slate-400">Muestra el reverso, donde aparece tu huella.</p>
      </div>
    </div>
  );
}

export function ExtractedFields({ fields, readText = true }: { fields: DocumentFields | null; readText?: boolean }) {
  const rows: [string, string | null][] = [
    ["Número", fields?.number ?? null],
    ["Apellidos", fields?.surnames ?? null],
    ["Nombres", fields?.names ?? null],
    ["Nacimiento", fields?.birthDate ?? null],
    ["Sexo", fields?.sex ?? null],
    ["G.S. / RH", fields?.bloodType ?? null],
  ];
  return (
    <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
      <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400">
        <CreditCard className="h-3.5 w-3.5" /> Datos extraídos (OCR)
      </p>
      {!readText ? (
        <p className="text-sm text-slate-400">Lectura de texto desactivada.</p>
      ) : !fields ? (
        <p className="text-sm text-slate-400">No se leyeron datos del documento.</p>
      ) : (
        <>
          <dl className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-2 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-slate-400">{k}</dt>
                <dd className={v ? "font-medium text-white" : "text-slate-500"}>{v ?? "No detectado"}</dd>
              </div>
            ))}
          </dl>
          {fields.raw && (
            <details className="mt-3 text-xs text-slate-400">
              <summary className="cursor-pointer select-none hover:text-white">Ver texto completo</summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 font-mono">{fields.raw}</pre>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function ProcessStep({ done, active, label }: { done: boolean; active: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-2.5 ${done ? "text-emerald-300" : active ? "text-white" : "text-slate-500"}`}>
      {done ? (
        <Check className="h-4 w-4" />
      ) : active ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <span className="h-4 w-4 rounded-full border border-current" />
      )}
      {label}
    </li>
  );
}

function DocIllustration() {
  return (
    <div className="relative h-24 w-40">
      {/* Reverso detrás */}
      <div className="absolute inset-0 translate-x-4 -translate-y-3 rotate-[6deg] rounded-xl bg-slate-700 p-2.5 ring-1 ring-white/10">
        <div className="grid h-[70%] w-9 place-items-center rounded-md bg-slate-600">
          <Fingerprint className="h-5 w-5 text-cyan-300/70" />
        </div>
      </div>
      {/* Frente con foto a la derecha */}
      <div className="absolute inset-0 -translate-x-2 flex gap-2 rounded-xl bg-slate-800 p-3 ring-1 ring-white/15">
        <div className="flex-1 space-y-1.5 pt-1">
          <div className="h-1.5 w-full rounded bg-white/25" />
          <div className="h-1.5 w-3/4 rounded bg-white/15" />
          <div className="h-1.5 w-1/2 rounded bg-white/15" />
          <div className="mt-3 h-1.5 w-2/3 rounded bg-cyan-300/40" />
        </div>
        <div className="grid h-full w-11 place-items-center rounded-md bg-slate-700">
          <ScanFace className="h-5 w-5 text-cyan-300" />
        </div>
      </div>
    </div>
  );
}
