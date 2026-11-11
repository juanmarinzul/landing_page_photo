import type { Metadata } from "next";
import { CreditCard, Focus, Sparkles, Sun } from "lucide-react";
import { ModuleShell } from "@/components/site/ModuleShell";
import { DocumentFlow } from "@/components/flows/Flows";

export const metadata: Metadata = { title: "Escaneo de documento" };

export default function DocumentoPage() {
  return (
    <ModuleShell
      eyebrow="Módulo 02 · Documento de identidad"
      title="Escaneo inteligente de documentos"
      description="Captura automática con control de calidad en tiempo real, detección de la foto del titular y lectura de datos (OCR)."
      tips={[
        { Icon: CreditCard, text: "Escanea ambos lados: primero el frente (con tu foto) y luego el reverso (con tu huella)." },
        { Icon: Sun, text: "Coloca el documento sobre una superficie oscura y bien iluminada." },
        { Icon: Sparkles, text: "Inclínalo ligeramente si aparecen reflejos." },
        { Icon: Focus, text: "Llena el marco con el documento y espera el enfoque." },
      ]}
    >
      <DocumentFlow />
    </ModuleShell>
  );
}
