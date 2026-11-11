import type { Metadata } from "next";
import { Eye, Lightbulb, ScanFace, Smile } from "lucide-react";
import { ModuleShell } from "@/components/site/ModuleShell";
import { FaceFlow } from "@/components/flows/Flows";

export const metadata: Metadata = { title: "Reconocimiento facial" };

export default function RostroPage() {
  return (
    <ModuleShell
      eyebrow="Módulo 01 · Biometría facial"
      title="Reconocimiento facial con prueba de vida"
      description="Como en tu app bancaria: ubica tu rostro en el óvalo y realiza acciones aleatorias para demostrar que eres una persona real."
      tips={[
        { Icon: Lightbulb, text: "Busca buena luz frontal, evita contraluz." },
        { Icon: ScanFace, text: "Retira gafas oscuras, gorra o tapabocas." },
        { Icon: Eye, text: "Mantén la cámara a la altura de los ojos." },
        { Icon: Smile, text: "Realiza cada acción de forma natural y pausada." },
      ]}
    >
      <FaceFlow />
    </ModuleShell>
  );
}
