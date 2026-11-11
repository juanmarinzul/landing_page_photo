"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, CreditCard, RotateCcw, ScanFace, ShieldCheck, UserCheck } from "lucide-react";
import FaceLiveness, { CHALLENGES, type FaceCapture } from "@/components/verify/FaceLiveness";
import DocumentScanner, { ExtractedFields, type DocumentCapture } from "@/components/verify/DocumentScanner";
import MatchResult from "@/components/verify/MatchResult";

const fade = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
  transition: { duration: 0.35 },
};

function SuccessBanner({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-emerald-400/10 p-4 ring-1 ring-emerald-400/25">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-400 text-slate-950">
        <Check className="h-6 w-6" strokeWidth={3} />
      </span>
      <div>
        <p className="font-semibold text-white">{title}</p>
        <p className="text-sm text-emerald-100/70">{text}</p>
      </div>
    </div>
  );
}

function NextActions({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="flex flex-wrap justify-end gap-3">
      <button onClick={onRestart} className="btn-ghost">
        <RotateCcw className="h-4 w-4" /> Repetir
      </button>
      <Link href="/verificacion" className="btn-primary">
        Verificación completa <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

export function FaceFlow() {
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<FaceCapture | null>(null);
  const restart = () => {
    setResult(null);
    setRun((r) => r + 1);
  };

  return (
    <AnimatePresence mode="wait">
      {!result ? (
        <motion.div key={`cam-${run}`} {...fade}>
          <FaceLiveness onComplete={setResult} />
        </motion.div>
      ) : (
        <motion.div key="result" {...fade} className="mx-auto max-w-2xl space-y-5">
          <SuccessBanner title="Prueba de vida superada" text="Confirmamos que hay una persona real frente a la cámara." />
          <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.image} alt="Selfie" className="aspect-[3/4] w-full rounded-3xl object-cover ring-1 ring-white/15" />
            <div className="space-y-3 rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
              <p className="text-xs uppercase tracking-wider text-slate-400">Resultado del análisis</p>
              <Stat k="Acciones completadas" v={result.challenges.map((c) => CHALLENGES[c].label).join(" · ")} />
              <Stat k="Tiempo total" v={`${(result.durationMs / 1000).toFixed(1)} segundos`} />
              <Stat k="Confianza de detección" v={`${(result.confidence * 100).toFixed(1)}%`} />
              <Stat k="Plantilla biométrica" v={`Vector de ${result.descriptor.length} dimensiones`} />
            </div>
          </div>
          <NextActions onRestart={restart} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function DocumentFlow() {
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<DocumentCapture | null>(null);
  const restart = () => {
    setResult(null);
    setRun((r) => r + 1);
  };

  return (
    <AnimatePresence mode="wait">
      {!result ? (
        <motion.div key={`cam-${run}`} {...fade}>
          <DocumentScanner onComplete={setResult} />
        </motion.div>
      ) : (
        <motion.div key="result" {...fade} className="mx-auto max-w-2xl space-y-5">
          <SuccessBanner title="Documento analizado" text="Escaneamos ambos lados, detectamos la foto del titular y extrajimos sus datos." />
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              [result.image, "Frente"],
              [result.backImage, "Reverso"],
            ].map(([src, label]) => (
              <figure key={label} className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={label} className="w-full rounded-2xl ring-1 ring-white/15" />
                <figcaption className="text-xs uppercase tracking-wider text-slate-400">{label}</figcaption>
              </figure>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <div className="rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/10">
              <p className="mb-2 text-xs uppercase tracking-wider text-slate-400">Titular</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.face} alt="Rostro del titular" className="w-full rounded-xl" />
              <p className="mt-2 text-center text-xs text-slate-400">Confianza {(result.faceScore * 100).toFixed(0)}%</p>
            </div>
            <ExtractedFields fields={result.fields} />
          </div>
          <NextActions onRestart={restart} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="border-b border-white/5 pb-3 last:border-0 last:pb-0">
      <p className="text-xs text-slate-400">{k}</p>
      <p className="font-medium text-white">{v}</p>
    </div>
  );
}

const STEPS = [
  { label: "Documento", Icon: CreditCard },
  { label: "Rostro en vivo", Icon: ScanFace },
  { label: "Resultado", Icon: UserCheck },
];

export function VerificationFlow() {
  const [run, setRun] = useState(0);
  const [step, setStep] = useState(-1);
  const [doc, setDoc] = useState<DocumentCapture | null>(null);
  const [face, setFace] = useState<FaceCapture | null>(null);

  const restart = () => {
    setDoc(null);
    setFace(null);
    setStep(0);
    setRun((r) => r + 1);
  };

  return (
    <div className="space-y-8">
      {step >= 0 && <Stepper current={step} />}
      <AnimatePresence mode="wait">
        {step === -1 && (
          <motion.div key="intro" {...fade} className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-slate-950">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-white">Antes de comenzar</h2>
            <p className="mt-2 text-slate-400">El proceso toma menos de un minuto. Necesitarás:</p>
            <ul className="mx-auto mt-6 max-w-sm space-y-3 text-left text-sm text-slate-300">
              {[
                "Tu cédula original: escanearemos el frente y el reverso",
                "Un lugar bien iluminado, sin luz directa detrás de ti",
                "Retirar gafas de sol, gorras o tapabocas",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /> {t}
                </li>
              ))}
            </ul>
            <label className="mx-auto mt-6 flex max-w-sm items-start gap-3 rounded-xl bg-white/[0.03] p-3 text-left text-xs text-slate-400 ring-1 ring-white/10">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              Al continuar autorizas el uso de tu cámara para capturar tu documento y rostro. Las imágenes se procesan solo en este dispositivo.
            </label>
            <button onClick={() => setStep(0)} className="btn-primary mt-6">
              Comenzar verificación <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}
        {step === 0 && (
          <motion.div key={`doc-${run}`} {...fade}>
            <StepTitle n={1} title="Escanea tu documento de identidad" text="Primero el frente (con tu foto) y luego el reverso (con tu huella)." />
            <DocumentScanner
              onComplete={(d) => {
                setDoc(d);
                setStep(1);
              }}
            />
          </motion.div>
        )}
        {step === 1 && (
          <motion.div key={`face-${run}`} {...fade}>
            <StepTitle n={2} title="Verifica que eres tú" text="Sigue las instrucciones en pantalla para la prueba de vida." />
            <FaceLiveness
              onComplete={(f) => {
                setFace(f);
                setStep(2);
              }}
            />
          </motion.div>
        )}
        {step === 2 && doc && face && (
          <motion.div key="result" {...fade}>
            <MatchResult document={doc} face={face} onRestart={restart} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StepTitle({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div className="mb-6 text-center">
      <p className="text-xs font-medium uppercase tracking-wider text-emerald-300">Paso {n} de 2</p>
      <h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl">{title}</h2>
      <p className="mt-1 text-sm text-slate-400">{text}</p>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="mx-auto flex max-w-xl items-center">
      {STEPS.map(({ label, Icon }, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <span
                className={`grid h-10 w-10 place-items-center rounded-full ring-1 transition-colors ${
                  done
                    ? "bg-emerald-400 text-slate-950 ring-emerald-400"
                    : active
                      ? "bg-white/10 text-white ring-white/40"
                      : "bg-white/[0.03] text-slate-500 ring-white/10"
                }`}
              >
                {done ? <Check className="h-5 w-5" strokeWidth={3} /> : <Icon className="h-5 w-5" />}
              </span>
              <span className={`whitespace-nowrap text-xs ${active || done ? "text-white" : "text-slate-500"}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="mx-2 mb-6 h-px flex-1 bg-white/10">
                <motion.div className="h-px bg-emerald-400" animate={{ width: done ? "100%" : "0%" }} transition={{ duration: 0.5 }} />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
