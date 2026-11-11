import type { Metadata } from "next";
import { CreditCard, Fingerprint, ScanFace, UserCheck } from "lucide-react";
import { ModuleShell } from "@/components/site/ModuleShell";
import { VerificationFlow } from "@/components/flows/Flows";

export const metadata: Metadata = { title: "Verificación de identidad" };

export default function VerificacionPage() {
  return (
    <ModuleShell
      eyebrow="Módulo 03 · Onboarding completo"
      title="Verifica que eres el titular del documento"
      description="Combinamos el escaneo del documento con tu rostro en vivo y comparamos ambas biometrías para confirmar tu identidad."
      tips={[
        { Icon: CreditCard, text: "Escaneamos tu documento y extraemos la foto del titular." },
        { Icon: ScanFace, text: "Realizas una prueba de vida con tu cámara frontal." },
        { Icon: Fingerprint, text: "Generamos plantillas biométricas de 128 dimensiones." },
        { Icon: UserCheck, text: "Comparamos ambos rostros y emitimos un veredicto." },
      ]}
    >
      <VerificationFlow />
    </ModuleShell>
  );
}
