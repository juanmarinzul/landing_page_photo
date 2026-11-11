"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Eye,
  RefreshCw,
  ScanFace,
  Smile,
  type LucideIcon,
} from "lucide-react";
import { useCamera } from "@/hooks/useCamera";
import {
  coverRect,
  cropToDataUrl,
  describeFace,
  estimateYaw,
  eyeAspectRatio,
  eyeContrast,
  median,
  preloadFaceApi,
  prepareFaceApi,
  type FaceApi,
} from "@/lib/face";
import { PreparingStatus } from "./PreparingStatus";

export type Challenge = "blink" | "left" | "right" | "smile";

export type FaceCapture = {
  image: string;
  descriptor: Float32Array;
  challenges: Challenge[];
  durationMs: number;
  confidence: number;
};

export const CHALLENGES: Record<Challenge, { label: string; hint: string; Icon: LucideIcon }> = {
  blink: { label: "Parpadea", hint: "Cierra los ojos un instante y vuelve a abrirlos", Icon: Eye },
  left: { label: "Gira a tu izquierda", hint: "Gira suavemente la cabeza", Icon: ArrowLeft },
  right: { label: "Gira a tu derecha", hint: "Gira suavemente la cabeza", Icon: ArrowRight },
  smile: { label: "Sonríe", hint: "Muestra una sonrisa natural", Icon: Smile },
};

type Phase = "intro" | "loading" | "position" | "challenge" | "capture" | "done" | "error";
type Tone = "neutral" | "ok" | "warn";

const OVAL = { cx: 0.5, cy: 0.475, rx: 0.36, ry: 0.355 };
const CHALLENGE_TIMEOUT = 10_000;
const MAX_TIMEOUTS = 4;
/** Ancho del cuadro que se analiza: mucho más rápido que el video completo y suficiente para los landmarks. */
const ANALYSIS_WIDTH = 480;
const USER_CAMERA = { width: 1280, height: 720 };
const BASELINE_SIZE = 40;
const now = () => performance.now();
const ELLIPSE = "M150 48 a108 142 0 1 1 0 284 a108 142 0 1 1 0 -284";

function shuffle<T>(items: T[]): T[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

const pickChallenges = (): Challenge[] => shuffle(["blink", "smile", Math.random() < 0.5 ? "left" : "right"]);

export default function FaceLiveness({ onComplete }: { onComplete: (capture: FaceCapture) => void }) {
  const { videoRef, status: cameraStatus, start: startCamera, stop: stopCamera } = useCamera("user", USER_CAMERA);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLCanvasElement | null>(null);
  const eyeRef = useRef<HTMLCanvasElement | null>(null);
  const faceapiRef = useRef<FaceApi | null>(null);
  const runningRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const m = useRef({
    phase: "intro" as Phase,
    goodFrames: 0,
    challenges: [] as Challenge[],
    idx: 0,
    challengeStart: 0,
    startedAt: 0,
    // Referencia de "ojos abiertos" de esta persona, acumulada durante toda la sesión.
    earBase: [] as number[],
    contrastBase: [] as number[],
    eyesClosed: false,
    closedAt: 0,
    timeouts: 0,
    timeoutsHere: 0,
    captureFails: 0,
    busy: false,
    message: "",
  });

  const [phase, setPhaseState] = useState<Phase>("intro");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<Tone>("neutral");
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [idx, setIdx] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // La IA empieza a descargarse y prepararse apenas se abre la página.
  useEffect(() => preloadFaceApi(), []);

  useEffect(
    () => () => {
      runningRef.current = false;
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  const setPhase = (p: Phase) => {
    m.current.phase = p;
    setPhaseState(p);
  };

  const feedback = (text: string, t: Tone) => {
    if (m.current.message === text + t) return;
    m.current.message = text + t;
    setMessage(text);
    setTone(t);
  };

  const showNotice = (text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3500);
  };

  const fail = (text: string) => {
    runningRef.current = false;
    stopCamera();
    clearOverlay();
    setError(text);
    setPhase("error");
  };

  const clearOverlay = () => {
    const c = canvasRef.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
  };

  async function begin() {
    setError(null);
    setPreview(null);
    setNotice(null);
    setPhase("loading");
    feedback("Preparando la verificación…", "neutral");
    const [faceapi, camError] = await Promise.all([prepareFaceApi(), startCamera()]);
    if (camError) return fail(camError);
    if (!faceapi) return fail("La preparación de la IA está tardando demasiado. Revisa tu conexión y vuelve a intentarlo.");
    faceapiRef.current = faceapi;

    const picked = pickChallenges();
    Object.assign(m.current, {
      goodFrames: 0,
      challenges: picked,
      idx: 0,
      earBase: [],
      contrastBase: [],
      eyesClosed: false,
      timeouts: 0,
      timeoutsHere: 0,
      captureFails: 0,
      busy: false,
      startedAt: now(),
    });
    setChallenges(picked);
    setIdx(0);
    setPhase("position");
    runningRef.current = true;
    loop();
  }

  /** Copia reducida del cuadro actual del video (reutiliza el mismo canvas). */
  function grabFrame(video: HTMLVideoElement): HTMLCanvasElement {
    const frame = (frameRef.current ??= document.createElement("canvas"));
    const w = ANALYSIS_WIDTH;
    const h = Math.round((video.videoHeight / video.videoWidth) * w);
    if (frame.width !== w || frame.height !== h) {
      frame.width = w;
      frame.height = h;
    }
    frame.getContext("2d", { willReadFrequently: true })!.drawImage(video, 0, 0, w, h);
    return frame;
  }

  async function loop() {
    const faceapi = faceapiRef.current;
    const video = videoRef.current;
    if (!runningRef.current || !faceapi || !video) return;
    if (video.readyState >= 2 && video.videoWidth && !m.current.busy) {
      try {
        const frame = grabFrame(video);
        const s = m.current;
        // La red de expresiones solo hace falta para sonreír y para la captura final.
        const needExpressions =
          s.phase === "capture" || (s.phase === "challenge" && s.challenges[s.idx] === "smile");
        const base = faceapi
          .detectSingleFace(frame, new faceapi.TinyFaceDetectorOptions({ inputSize: 288, scoreThreshold: 0.45 }))
          .withFaceLandmarks();
        const det = needExpressions ? await base.withFaceExpressions() : await base;
        if (runningRef.current) await process(faceapi, video, frame, det ?? null);
      } catch {
        /* frame perdido: continuamos */
      }
    }
    // Cedemos el hilo al navegador entre análisis para que la interfaz nunca se congele.
    if (runningRef.current) setTimeout(loop, 0);
  }

  type Detection = Awaited<ReturnType<ReturnType<FaceApi["detectSingleFace"]>["withFaceLandmarks"]>> & {
    expressions?: { happy: number };
  };

  async function process(faceapi: FaceApi, video: HTMLVideoElement, frame: HTMLCanvasElement, det: Detection | null) {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const c = coverRect(frame.width, frame.height, cw, ch);
    const s = m.current;

    // Malla de puntos sobre el rostro
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== cw * dpr) {
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
    }
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    if (s.phase === "challenge" && now() - s.challengeStart > CHALLENGE_TIMEOUT) {
      handleTimeout();
      return;
    }

    if (!det) {
      s.goodFrames = 0;
      feedback("Ubica tu rostro dentro del óvalo", "warn");
      return;
    }
    const pts = det.landmarks.positions;
    ctx.fillStyle = "rgba(94, 234, 212, 0.55)";
    for (const p of pts) {
      const x = (1 - (p.x - c.sx) / c.sw) * cw;
      const y = ((p.y - c.sy) / c.sh) * ch;
      ctx.beginPath();
      ctx.arc(x, y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    const box = det.detection.box;
    const cx = 1 - (box.x + box.width / 2 - c.sx) / c.sw;
    const cy = (box.y + box.height / 2 - c.sy) / c.sh;
    const width = box.width / c.sw;
    const yaw = estimateYaw(pts);
    const happy = det.expressions?.happy ?? 0;
    const offset = ((cx - OVAL.cx) / OVAL.rx) ** 2 + ((cy - OVAL.cy) / OVAL.ry) ** 2;

    // Apertura de ojos: geometría (EAR) + contraste de píxeles.
    const leftEye = det.landmarks.getLeftEye();
    const rightEye = det.landmarks.getRightEye();
    const ear = (eyeAspectRatio(leftEye) + eyeAspectRatio(rightEye)) / 2;
    const scratch = (eyeRef.current ??= document.createElement("canvas"));
    const contrast = (eyeContrast(frame, leftEye, scratch) + eyeContrast(frame, rightEye, scratch)) / 2;
    const earRef = median(s.earBase);
    const contrastRef = median(s.contrastBase);
    const calibrated = s.earBase.length >= 6;
    const looksClosed = calibrated && (ear < earRef * 0.8 || contrast < contrastRef * 0.68);
    const looksOpen = !calibrated || (ear > earRef * 0.9 && contrast > contrastRef * 0.85);
    // Solo frames de frente y con ojos abiertos alimentan la referencia.
    if (Math.abs(yaw) < 0.2 && !looksClosed && !s.eyesClosed) {
      s.earBase.push(ear);
      s.contrastBase.push(contrast);
      if (s.earBase.length > BASELINE_SIZE) {
        s.earBase.shift();
        s.contrastBase.shift();
      }
    }

    if (s.phase === "position" || s.phase === "capture") {
      let issue: string | null = null;
      if (width < 0.36) issue = "Acércate un poco a la cámara";
      else if (width > 0.78) issue = "Aléjate un poco de la cámara";
      else if (offset > 0.3) issue = "Centra tu rostro en el óvalo";
      else if (Math.abs(yaw) > (s.phase === "capture" ? 0.16 : 0.25)) issue = "Mira directamente a la cámara";
      else if (s.phase === "capture" && happy > 0.6) issue = "Mantén una expresión neutral";
      else if (s.phase === "capture" && looksClosed) issue = "Mantén los ojos abiertos";

      if (issue) {
        s.goodFrames = 0;
        feedback(issue, "warn");
        return;
      }
      s.goodFrames++;

      if (s.phase === "position") {
        feedback("¡Perfecto! Mantente así", "ok");
        if (s.goodFrames >= 10) startChallenge(0, true);
        return;
      }

      feedback("Capturando… no te muevas", "ok");
      if (s.goodFrames >= 4) await capture(faceapi, video);
      return;
    }

    if (s.phase === "challenge") {
      if (offset > 0.9 || width < 0.25) {
        feedback("Mantén tu rostro dentro del óvalo", "warn");
        return;
      }
      const current = s.challenges[s.idx];

      let passed = false;
      if (current === "blink") {
        if (!s.eyesClosed && looksClosed) {
          s.eyesClosed = true;
          s.closedAt = now();
        } else if (s.eyesClosed && looksOpen) {
          passed = true;
        } else if (s.eyesClosed && now() - s.closedAt > 2500) {
          // Ojos "cerrados" demasiado tiempo: probablemente mira hacia abajo. Reiniciamos.
          s.eyesClosed = false;
        }
        feedback(s.eyesClosed ? "¡Bien! Ahora abre los ojos" : CHALLENGES.blink.hint, s.eyesClosed ? "ok" : "neutral");
      } else {
        feedback(CHALLENGES[current].hint, "neutral");
        if (current === "left") passed = yaw > 0.3;
        else if (current === "right") passed = yaw < -0.3;
        else if (current === "smile") passed = happy > 0.75;
      }

      if (passed) {
        const next = s.idx + 1;
        if (next >= s.challenges.length) {
          s.idx = next;
          setIdx(next);
          s.goodFrames = 0;
          setPhase("capture");
          feedback("Ahora mira al frente", "ok");
        } else {
          startChallenge(next, true);
        }
      }
    }
  }

  /**
   * Si una acción no se detecta a tiempo no abortamos todo el proceso: se repite y,
   * si vuelve a fallar, se cambia por otra acción aleatoria que aún no se haya usado.
   */
  function handleTimeout() {
    const s = m.current;
    s.timeouts++;
    s.timeoutsHere++;
    if (s.timeouts > MAX_TIMEOUTS) {
      fail("No pudimos detectar las acciones solicitadas. Busca buena iluminación frontal y vuelve a intentarlo.");
      return;
    }
    if (s.timeoutsHere >= 2) {
      const unused = (["blink", "smile", "left", "right"] as Challenge[]).filter((c) => !s.challenges.includes(c));
      const replacement = shuffle(unused)[0];
      if (replacement) {
        s.challenges = s.challenges.map((c, i) => (i === s.idx ? replacement : c));
        setChallenges(s.challenges);
        showNotice(`Probemos otra acción: ${CHALLENGES[replacement].label.toLowerCase()}`);
        startChallenge(s.idx, true);
        return;
      }
    }
    showNotice("No detectamos la acción. Intentémoslo otra vez, con calma.");
    startChallenge(s.idx, false);
  }

  function startChallenge(i: number, fresh: boolean) {
    const s = m.current;
    s.idx = i;
    s.challengeStart = now();
    s.eyesClosed = false;
    if (fresh) s.timeoutsHere = 0;
    setIdx(i);
    setAttempt((a) => a + 1);
    setPhase("challenge");
  }

  async function capture(faceapi: FaceApi, video: HTMLVideoElement) {
    const s = m.current;
    s.busy = true;
    try {
      // Copia de 720 px: precisión suficiente para el descriptor sin bloquear la UI.
      const shot = document.createElement("canvas");
      shot.width = 720;
      shot.height = Math.round((video.videoHeight / video.videoWidth) * 720);
      shot.getContext("2d")!.drawImage(video, 0, 0, shot.width, shot.height);
      const full = await describeFace(faceapi, shot, "selfie");
      if (!full) {
        s.goodFrames = 0;
        s.captureFails++;
        if (s.captureFails >= 6) {
          fail("No pudimos generar tu plantilla facial en este dispositivo. Intenta con mejor iluminación o desde otro navegador.");
        }
        return;
      }
      const container = containerRef.current;
      const c = coverRect(shot.width, shot.height, container?.clientWidth ?? 3, container?.clientHeight ?? 4);
      const image = cropToDataUrl(shot, c.sx, c.sy, c.sw, c.sh, { mirror: true, maxWidth: 720 });
      runningRef.current = false;
      stopCamera();
      clearOverlay();
      setPreview(image);
      setPhase("done");
      const result: FaceCapture = {
        image,
        descriptor: full.descriptor,
        challenges: s.challenges,
        durationMs: now() - s.startedAt,
        confidence: full.score,
      };
      setTimeout(() => onCompleteRef.current(result), 1400);
    } finally {
      s.busy = false;
    }
  }

  const ovalColor =
    phase === "done" ? "#34d399" : tone === "ok" ? "#34d399" : tone === "warn" ? "#fbbf24" : "rgba(255,255,255,0.55)";
  const total = Math.max(challenges.length, 1);
  const progress = phase === "done" ? 100 : phase === "capture" ? 92 : phase === "challenge" ? (idx / total) * 85 : 0;
  const active = phase === "position" || phase === "challenge" || phase === "capture";
  const current = phase === "challenge" ? challenges[idx] : null;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div
        ref={containerRef}
        className="relative aspect-[3/4] w-full max-w-[380px] overflow-hidden rounded-[2.25rem] border border-white/10 bg-slate-950 shadow-2xl shadow-emerald-500/5"
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
        />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Captura" className="absolute inset-0 h-full w-full object-cover" />
        )}

        <svg viewBox="0 0 300 400" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
          <path
            fillRule="evenodd"
            fill="rgba(3,6,14,0.78)"
            d={`M0 0h300v400H0z ${ELLIPSE}`}
          />
          <path d={ELLIPSE} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
          <motion.path
            d={ELLIPSE}
            fill="none"
            stroke={ovalColor}
            strokeWidth="4"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="100 100"
            initial={false}
            animate={{ strokeDashoffset: 100 - (active || phase === "done" ? Math.max(progress, 6) : 0), stroke: ovalColor }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </svg>

        {(phase === "position" || phase === "capture") && (
          <div className="pointer-events-none absolute inset-x-[14%] top-[14%] bottom-[19%] overflow-hidden rounded-[50%]">
            <div className="animate-scan absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-emerald-400/20 to-transparent" />
          </div>
        )}

        {/* Mensaje superior */}
        <AnimatePresence mode="wait">
          {active && message && (
            <motion.div
              key={message}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`absolute inset-x-4 top-4 rounded-2xl px-4 py-2.5 text-center text-sm font-medium backdrop-blur-md ${
                tone === "warn"
                  ? "bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/30"
                  : tone === "ok"
                    ? "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/30"
                    : "bg-white/10 text-white ring-1 ring-white/15"
              }`}
            >
              {message}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {active && notice && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute inset-x-6 top-[4.5rem] rounded-xl bg-slate-900/80 px-3 py-2 text-center text-xs font-medium text-amber-200 ring-1 ring-amber-300/30 backdrop-blur-md"
            >
              {notice}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reto actual */}
        <AnimatePresence mode="wait">
          {current && (
            <motion.div
              key={`${current}-${attempt}`}
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-x-6 bottom-5 flex items-center gap-3 rounded-2xl bg-slate-900/80 p-3 ring-1 ring-white/10 backdrop-blur-md"
            >
              <ChallengeIcon challenge={current} />
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wider text-slate-400">
                  Acción {idx + 1} de {challenges.length}
                </p>
                <p className="font-semibold text-white">{CHALLENGES[current].label}</p>
                <Countdown seconds={CHALLENGE_TIMEOUT / 1000} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Estados que cubren la cámara */}
        <AnimatePresence>
          {(phase === "intro" || phase === "loading" || phase === "error") && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-slate-950/90 p-8 text-center backdrop-blur-sm"
            >
              {phase === "intro" && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/20" />
                    <div className="relative grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 text-slate-950">
                      <ScanFace className="h-10 w-10" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Verificación facial</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Te pediremos realizar {3} acciones simples para confirmar que eres una persona real.
                    </p>
                  </div>
                  <button onClick={begin} className="btn-primary">
                    <Camera className="h-4 w-4" /> Activar cámara
                  </button>
                </>
              )}
              {phase === "loading" && (
                <>
                  <p className="font-semibold text-white">Preparando la verificación</p>
                  <PreparingStatus camera={cameraStatus} />
                </>
              )}
              {phase === "error" && (
                <>
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30">
                    <AlertTriangle className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">No pudimos completar la verificación</p>
                    <p className="mt-1 text-sm text-slate-400">{error}</p>
                  </div>
                  <button onClick={begin} className="btn-primary">
                    <RefreshCw className="h-4 w-4" /> Reintentar
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === "done" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent p-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/40"
              >
                <Check className="h-8 w-8" strokeWidth={3} />
              </motion.div>
              <p className="text-lg font-semibold text-white">Prueba de vida superada</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Lista de acciones */}
      {challenges.length > 0 && phase !== "error" && (
        <ol className="flex w-full max-w-[380px] gap-2">
          {challenges.map((ch, i) => {
            const state = phase === "done" || phase === "capture" || i < idx ? "done" : phase === "challenge" && i === idx ? "active" : "pending";
            const { Icon, label } = CHALLENGES[ch];
            return (
              <li
                key={ch}
                className={`flex flex-1 flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-center text-xs transition-colors ${
                  state === "done"
                    ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/30"
                    : state === "active"
                      ? "bg-white/10 text-white ring-1 ring-white/25"
                      : "bg-white/[0.03] text-slate-500 ring-1 ring-white/5"
                }`}
              >
                {state === "done" ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                <span className="leading-tight">{label}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function ChallengeIcon({ challenge }: { challenge: Challenge }) {
  const { Icon } = CHALLENGES[challenge];
  const motionProps =
    challenge === "left"
      ? { animate: { x: [0, -5, 0] } }
      : challenge === "right"
        ? { animate: { x: [0, 5, 0] } }
        : challenge === "blink"
          ? { animate: { scaleY: [1, 0.1, 1] } }
          : { animate: { scale: [1, 1.15, 1] } };
  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-slate-950">
      <motion.div {...motionProps} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}>
        <Icon className="h-6 w-6" strokeWidth={2.5} />
      </motion.div>
    </div>
  );
}

function Countdown({ seconds }: { seconds: number }) {
  return (
    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
      <motion.div
        className="h-full rounded-full bg-emerald-400"
        initial={{ width: "100%" }}
        animate={{ width: "0%" }}
        transition={{ duration: seconds, ease: "linear" }}
      />
    </div>
  );
}
