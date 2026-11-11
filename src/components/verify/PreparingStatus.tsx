"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { subscribeAiStatus, type AiStatus } from "@/lib/face";
import type { CameraStatus } from "@/hooks/useCamera";

/** Progreso visible de la preparación: cámara, descarga de modelos y optimización. */
export function PreparingStatus({ camera }: { camera: CameraStatus }) {
  const [ai, setAi] = useState<AiStatus | null>(null);
  useEffect(() => subscribeAiStatus(setAi), []);

  const modelsDone = !!ai && ai.models >= ai.modelsTotal;
  const steps = [
    { label: camera === "ready" ? "Cámara activa" : "Activando cámara", done: camera === "ready" },
    {
      label: modelsDone ? "Modelos de IA cargados" : `Descargando modelos de IA (${ai?.models ?? 0}/${ai?.modelsTotal ?? 5})`,
      done: modelsDone,
    },
    {
      label: ai?.ready ? "Optimizado para tu dispositivo" : "Optimizando para tu dispositivo",
      done: !!ai?.ready,
      active: modelsDone,
    },
  ];
  const total = ai ? ai.modelsTotal + ai.warmTotal + 1 : 1;
  const progress = ai ? (ai.models + ai.warm + (camera === "ready" ? 1 : 0)) / total : 0;

  return (
    <div className="w-full max-w-xs space-y-4">
      <ul className="space-y-2.5 text-left text-sm">
        {steps.map((s, i) => {
          const active = !s.done && (s.active ?? (i === 0 || steps[i - 1].done || i === 1));
          return (
            <li
              key={i}
              className={`flex items-center gap-2.5 ${s.done ? "text-emerald-300" : active ? "text-white" : "text-slate-500"}`}
            >
              {s.done ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : active ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <span className="h-4 w-4 shrink-0 rounded-full border border-current" />
              )}
              {s.label}
            </li>
          );
        })}
      </ul>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-[width] duration-500"
          style={{ width: `${Math.max(6, Math.round(progress * 100))}%` }}
        />
      </div>
      <p className="text-xs text-slate-500">Acepta el permiso de cámara si tu navegador lo solicita.</p>
    </div>
  );
}
