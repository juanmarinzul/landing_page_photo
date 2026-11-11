"use client";

import { useEffect, useMemo, useState } from "react";
import { animate, motion, useMotionValue, useMotionValueEvent } from "motion/react";
import { BadgeCheck, Download, RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import { MATCH_THRESHOLD, euclidean, similarityFromDistance } from "@/lib/face";
import { CHALLENGES, type FaceCapture } from "./FaceLiveness";
import { ExtractedFields, type DocumentCapture } from "./DocumentScanner";

export default function MatchResult({
  document,
  face,
  onRestart,
}: {
  document: DocumentCapture;
  face: FaceCapture;
  onRestart: () => void;
}) {
  const { distance, similarity, match } = useMemo(() => {
    const d = euclidean(document.descriptor, face.descriptor);
    return { distance: d, similarity: similarityFromDistance(d), match: d < MATCH_THRESHOLD };
  }, [document, face]);

  const [verificationId] = useState(() => `VRD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`);
  const [createdAt] = useState(() => new Date());

  const downloadReport = () => {
    const report = {
      id: verificationId,
      fecha: createdAt.toISOString(),
      resultado: match ? "APROBADO" : "RECHAZADO",
      similitud: Number((similarity * 100).toFixed(2)),
      distanciaEuclidiana: Number(distance.toFixed(4)),
      umbral: MATCH_THRESHOLD,
      pruebaDeVida: { superada: true, acciones: face.challenges, duracionSeg: Number((face.durationMs / 1000).toFixed(1)) },
      documento: {
        numero: document.fields?.number ?? null,
        apellidos: document.fields?.surnames ?? null,
        nombres: document.fields?.names ?? null,
        fechaNacimiento: document.fields?.birthDate ?? null,
        sexo: document.fields?.sex ?? null,
        rh: document.fields?.bloodType ?? null,
        ladosEscaneados: ["frente", "reverso"],
        nitidez: Math.round(document.quality.sharpness),
      },
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const a = Object.assign(window.document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `${verificationId}.json`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const accent = match ? "emerald" : "rose";

  return (
    <div className="w-full space-y-6">
      {/* Comparación visual */}
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div
          className={`pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full blur-3xl ${
            match ? "bg-emerald-500/20" : "bg-rose-500/20"
          }`}
        />
        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          <Portrait src={document.face} label="Documento" delay={0} />
          <ScoreGauge value={similarity} match={match} />
          <Portrait src={face.image} label="Selfie en vivo" delay={0.15} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="relative mt-8 flex flex-col items-center gap-2 text-center"
        >
          <div
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold ring-1 ${
              match ? "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30" : "bg-rose-400/15 text-rose-300 ring-rose-400/30"
            }`}
          >
            {match ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
            {match ? "Identidad verificada" : "La identidad no coincide"}
          </div>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            {match ? "La persona es el titular del documento" : "No pudimos confirmar al titular"}
          </h2>
          <p className="max-w-lg text-sm text-slate-400">
            {match
              ? "El rostro capturado en vivo coincide con la fotografía del documento de identidad."
              : "El rostro en vivo no coincide lo suficiente con la foto del documento. Repite el proceso con mejor iluminación o usa el documento correcto."}
          </p>
        </motion.div>
      </div>

      {/* Detalles */}
      <div className="grid gap-4 md:grid-cols-3">
        <DetailCard title="Comparación biométrica">
          <Row k="Similitud" v={`${(similarity * 100).toFixed(1)}%`} highlight={accent} />
          <Row k="Distancia" v={distance.toFixed(3)} />
          <Row k="Umbral" v={`< ${MATCH_THRESHOLD}`} />
        </DetailCard>
        <DetailCard title="Prueba de vida">
          <Row k="Estado" v="Superada" highlight="emerald" />
          <Row k="Acciones" v={face.challenges.map((c) => CHALLENGES[c].label.split(" ")[0]).join(", ")} />
          <Row k="Duración" v={`${(face.durationMs / 1000).toFixed(1)} s`} />
        </DetailCard>
        <DetailCard title="Documento">
          <Row k="Foto titular" v="Detectada" highlight="emerald" />
          <Row k="Confianza" v={`${(document.faceScore * 100).toFixed(0)}%`} />
          <Row k="Nitidez" v={document.quality.sharpness > 80 ? "Alta" : document.quality.sharpness > 40 ? "Media" : "Baja"} />
        </DetailCard>
      </div>

      <ExtractedFields fields={document.fields} readText={document.fields !== null} />

      <div className="flex flex-col items-center justify-between gap-4 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10 sm:flex-row">
        <div className="flex items-center gap-3 text-sm">
          <BadgeCheck className="h-5 w-5 text-slate-400" />
          <div>
            <p className="font-mono text-white">{verificationId}</p>
            <p className="text-xs text-slate-500">{createdAt.toLocaleString("es")}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={downloadReport} className="btn-ghost">
            <Download className="h-4 w-4" /> Descargar reporte
          </button>
          <button onClick={onRestart} className="btn-primary">
            <RotateCcw className="h-4 w-4" /> Nueva verificación
          </button>
        </div>
      </div>
    </div>
  );
}

function Portrait({ src, label, delay }: { src: string; label: string; delay: number }) {
  return (
    <motion.figure
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="flex flex-col items-center gap-2"
    >
      <div className="relative aspect-[3/4] w-full max-w-[180px] overflow-hidden rounded-3xl ring-1 ring-white/15">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label} className="h-full w-full object-cover" />
        <motion.div
          initial={{ top: "-20%" }}
          animate={{ top: "110%" }}
          transition={{ duration: 1.1, delay: delay + 0.2, ease: "easeInOut" }}
          className="absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-cyan-300/40 to-transparent"
        />
      </div>
      <figcaption className="text-xs uppercase tracking-wider text-slate-400">{label}</figcaption>
    </motion.figure>
  );
}

function ScoreGauge({ value, match }: { value: number; match: boolean }) {
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState(0);
  useMotionValueEvent(mv, "change", (v) => setDisplay(v));
  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.4, delay: 0.3, ease: "easeOut" });
    return () => controls.stop();
  }, [mv, value]);

  const r = 42;
  const circ = 2 * Math.PI * r;
  const color = match ? "#34d399" : "#fb7185";
  return (
    <div className="relative grid h-24 w-24 place-items-center sm:h-32 sm:w-32">
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - display)}
        />
      </svg>
      <div className="text-center">
        <p className="text-xl font-bold text-white tabular-nums sm:text-2xl">{(display * 100).toFixed(0)}%</p>
        <p className="text-[10px] uppercase tracking-wider text-slate-400">similitud</p>
      </div>
    </div>
  );
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
      <p className="mb-3 text-xs uppercase tracking-wider text-slate-400">{title}</p>
      <dl className="space-y-2 text-sm">{children}</dl>
    </div>
  );
}

function Row({ k, v, highlight }: { k: string; v: string; highlight?: "emerald" | "rose" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-400">{k}</dt>
      <dd
        className={`text-right font-medium ${
          highlight === "emerald" ? "text-emerald-300" : highlight === "rose" ? "text-rose-300" : "text-white"
        }`}
      >
        {v}
      </dd>
    </div>
  );
}
