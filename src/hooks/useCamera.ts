"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus = "idle" | "starting" | "ready" | "error";

function describeError(err: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "La cámara solo funciona en un contexto seguro (HTTPS o localhost).";
  }
  const name = err instanceof DOMException ? err.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Permiso de cámara denegado. Habilítalo desde el icono del candado en la barra de direcciones.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No encontramos ninguna cámara disponible en este dispositivo.";
    case "NotReadableError":
      return "La cámara está siendo usada por otra aplicación. Ciérrala e inténtalo de nuevo.";
    default:
      return "No pudimos iniciar la cámara. Inténtalo de nuevo.";
  }
}

export function useCamera(facingMode: "user" | "environment", resolution = { width: 1920, height: 1080 }) {
  const { width, height } = resolution;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
  }, []);

  /** Devuelve `null` si la cámara arrancó, o el mensaje de error. */
  const start = useCallback(async (): Promise<string | null> => {
    setError(null);
    setStatus("starting");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: width },
          height: { ideal: height },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        // Nunca esperamos indefinidamente al primer cuadro (algunos móviles no emiten el evento).
        await Promise.race([video.play().catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);
        if (video.readyState < 2) {
          await new Promise<void>((resolve) => {
            video.addEventListener("loadeddata", () => resolve(), { once: true });
            setTimeout(resolve, 4000);
          });
        }
      }
      setStatus("ready");
      return null;
    } catch (err) {
      const message = describeError(err);
      setError(message);
      setStatus("error");
      return message;
    }
  }, [facingMode, width, height]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  return { videoRef, status, error, start, stop };
}
