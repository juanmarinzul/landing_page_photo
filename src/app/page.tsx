import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Cpu,
  CreditCard,
  Eye,
  Fingerprint,
  Focus,
  Lock,
  ScanFace,
  ScanLine,
  ShieldCheck,
  Smile,
  UserCheck,
  Zap,
} from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";

const MODULES = [
  {
    href: "/rostro",
    tag: "Módulo 01",
    title: "Reconocimiento facial",
    text: "Prueba de vida activa estilo banca: óvalo guía, parpadeo, giro de cabeza y sonrisa en orden aleatorio.",
    Icon: ScanFace,
    points: ["Retos aleatorios anti-suplantación", "Malla de 68 puntos faciales", "Plantilla biométrica 128-D"],
  },
  {
    href: "/documento",
    tag: "Módulo 02",
    title: "Escaneo de documento",
    text: "Captura automática del documento con control de enfoque, luz y reflejos. Extrae la foto y los datos.",
    Icon: CreditCard,
    points: ["Autocaptura con control de calidad", "Detección de la foto del titular", "Lectura OCR de número y nombres"],
  },
  {
    href: "/verificacion",
    tag: "Módulo 03",
    title: "Rostro vs. documento",
    text: "Onboarding completo: confirma que quien está frente a la cámara es el propietario del documento.",
    Icon: UserCheck,
    points: ["Documento + prueba de vida", "Comparación biométrica 1:1", "Reporte descargable"],
    featured: true,
  },
];

const STEPS = [
  { Icon: CreditCard, title: "Escanea el documento", text: "Captura el frente y el reverso. El marco guía detecta cuándo la imagen es nítida, bien iluminada y sin reflejos." },
  { Icon: ScanFace, title: "Demuestra que eres real", text: "Ubica tu rostro en el óvalo y completa 3 acciones aleatorias que una foto o video no pueden imitar." },
  { Icon: BadgeCheck, title: "Obtén el veredicto", text: "Comparamos la foto del documento con tu rostro en vivo y calculamos el porcentaje de similitud." },
];

const SECURITY = [
  { Icon: Eye, title: "Prueba de vida activa", text: "Retos aleatorios en cada sesión que impiden ataques con fotos impresas o pantallas." },
  { Icon: Lock, title: "Privacidad por diseño", text: "Las imágenes nunca salen de tu dispositivo. Todo el análisis se ejecuta en el navegador." },
  { Icon: Focus, title: "Control de calidad", text: "Medimos nitidez, brillo y reflejos en tiempo real antes de aceptar una captura." },
  { Icon: Fingerprint, title: "Biometría 1:1", text: "Redes neuronales generan vectores faciales comparables con distancia euclidiana." },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="relative overflow-hidden">
        {/* HERO */}
        <section className="relative">
          <div className="grid-bg pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-emerald-200 ring-1 ring-white/10">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Verificación biométrica en el navegador
              </span>
              <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-6xl">
                Verifica identidades <span className="text-gradient">en segundos</span>, con la seguridad de un banco.
              </h1>
              <p className="mt-6 max-w-xl text-lg text-slate-400">
                Reconocimiento facial con prueba de vida, escaneo inteligente de documentos y validación rostro-documento.
                Sin instalaciones, sin servidores, sin fricción.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/verificacion" className="btn-primary !px-6 !py-3 !text-base">
                  Iniciar verificación <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="#modulos" className="btn-ghost !px-6 !py-3 !text-base">
                  Explorar módulos
                </Link>
              </div>
              <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-400">
                {["Sin instalar apps", "Procesamiento local", "Compatible con móvil"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <HeroVisual />
          </div>
        </section>

        {/* STATS */}
        <section className="border-y border-white/5 bg-white/[0.015]">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-4">
            {[
              ["< 45 s", "Onboarding completo"],
              ["68", "Puntos faciales rastreados"],
              ["128-D", "Vector biométrico"],
              ["0 bytes", "Enviados a servidores"],
            ].map(([v, l]) => (
              <div key={l} className="text-center">
                <p className="text-3xl font-semibold text-white">{v}</p>
                <p className="mt-1 text-sm text-slate-500">{l}</p>
              </div>
            ))}
          </div>
        </section>

        {/* MÓDULOS */}
        <section id="modulos" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
          <SectionHeading eyebrow="Módulos" title="Tres herramientas, un flujo de confianza" text="Úsalos por separado o combínalos en un onboarding completo." />
          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {MODULES.map(({ href, tag, title, text, Icon, points, featured }) => (
              <Link
                key={href}
                href={href}
                className={`group relative flex flex-col rounded-3xl p-6 ring-1 transition duration-300 hover:-translate-y-1 ${
                  featured
                    ? "bg-gradient-to-b from-emerald-400/10 to-cyan-400/[0.03] ring-emerald-400/30 hover:ring-emerald-400/60"
                    : "bg-white/[0.03] ring-white/10 hover:ring-white/25"
                }`}
              >
                {featured && (
                  <span className="absolute right-5 top-5 rounded-full bg-emerald-400 px-2.5 py-0.5 text-[11px] font-semibold text-slate-950">
                    Recomendado
                  </span>
                )}
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-slate-950">
                  <Icon className="h-6 w-6" />
                </span>
                <p className="mt-6 text-xs font-medium uppercase tracking-wider text-slate-500">{tag}</p>
                <h3 className="mt-1 text-xl font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm text-slate-400">{text}</p>
                <ul className="mt-5 space-y-2 text-sm text-slate-300">
                  {points.map((p) => (
                    <li key={p} className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0 text-emerald-400" /> {p}
                    </li>
                  ))}
                </ul>
                <span className="mt-auto flex items-center gap-1.5 pt-8 text-sm font-medium text-emerald-300">
                  Probar ahora <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* CÓMO FUNCIONA */}
        <section id="como-funciona" className="relative scroll-mt-20 border-y border-white/5 bg-white/[0.015] py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading eyebrow="Cómo funciona" title="Tan simple como tomarte una selfie" text="Una experiencia guiada que cualquier persona completa sin ayuda." />
            <ol className="relative mt-16 grid gap-10 md:grid-cols-3">
              <div className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-white/15 to-transparent md:block" />
              {STEPS.map(({ Icon, title, text }, i) => (
                <li key={title} className="relative text-center">
                  <span className="relative mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#0a0f1c] text-emerald-300 ring-1 ring-white/15">
                    <Icon className="h-6 w-6" />
                    <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-emerald-400 text-xs font-bold text-slate-950">
                      {i + 1}
                    </span>
                  </span>
                  <h3 className="mt-6 text-lg font-semibold text-white">{title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm text-slate-400">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* SEGURIDAD */}
        <section id="seguridad" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div>
              <SectionHeading
                align="left"
                eyebrow="Seguridad"
                title="Diseñado para frenar el fraude de identidad"
                text="Combinamos visión por computador e IA ejecutada localmente para detectar suplantaciones y proteger la privacidad de tus usuarios."
              />
              <div className="mt-8 flex flex-wrap gap-3 text-xs text-slate-300">
                {[
                  { Icon: Cpu, label: "TensorFlow.js + WebGL" },
                  { Icon: ScanLine, label: "OCR Tesseract" },
                  { Icon: Zap, label: "Tiempo real" },
                ].map(({ Icon, label }) => (
                  <span key={label} className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 ring-1 ring-white/10">
                    <Icon className="h-3.5 w-3.5 text-emerald-300" /> {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {SECURITY.map(({ Icon, title, text }) => (
                <div key={title} className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
                  <Icon className="h-5 w-5 text-emerald-300" />
                  <h3 className="mt-4 font-semibold text-white">{title}</h3>
                  <p className="mt-1.5 text-sm text-slate-400">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-400/15 via-teal-400/5 to-cyan-400/15 p-10 text-center ring-1 ring-emerald-400/20 sm:p-16">
            <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" />
            <ShieldCheck className="relative mx-auto h-12 w-12 text-emerald-300" />
            <h2 className="relative mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">¿Listo para verificar tu identidad?</h2>
            <p className="relative mx-auto mt-3 max-w-lg text-slate-300">Ten a la mano tu documento y busca un lugar iluminado. Toma menos de un minuto.</p>
            <Link href="/verificacion" className="btn-primary relative mt-8 !px-7 !py-3 !text-base">
              Comenzar ahora <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function SectionHeading({
  eyebrow,
  title,
  text,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  text: string;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-xl"}>
      <p className="text-sm font-medium text-emerald-300">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h2>
      <p className="mt-4 text-slate-400">{text}</p>
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      <div className="absolute inset-8 rounded-full bg-cyan-500/20 blur-3xl" />
      {/* Teléfono */}
      <div className="relative mx-auto w-[280px] rounded-[2.75rem] border border-white/15 bg-slate-900 p-2.5 shadow-2xl shadow-black/60">
        <div className="relative aspect-[9/19] overflow-hidden rounded-[2.25rem] bg-gradient-to-b from-slate-800 to-slate-950">
          <div className="absolute left-1/2 top-2.5 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
          <p className="absolute inset-x-0 top-12 text-center text-[11px] font-medium uppercase tracking-widest text-slate-400">
            Verificación facial
          </p>
          {/* Silueta del rostro */}
          <svg viewBox="0 0 200 260" className="absolute left-1/2 top-[22%] w-[78%] -translate-x-1/2">
            <defs>
              <linearGradient id="ring" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#34d399" />
                <stop offset="1" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
            <ellipse cx="100" cy="125" rx="78" ry="104" fill="rgba(255,255,255,0.03)" />
            <ellipse cx="100" cy="125" rx="78" ry="104" fill="none" stroke="url(#ring)" strokeWidth="4" strokeDasharray="420 600" strokeLinecap="round" />
            <g fill="rgba(94,234,212,0.7)">
              {[
                [70, 105], [80, 101], [90, 105], [110, 105], [120, 101], [130, 105],
                [100, 120], [100, 135], [92, 145], [108, 145],
                [80, 170], [90, 176], [100, 178], [110, 176], [120, 170],
                [58, 130], [62, 160], [75, 190], [100, 205], [125, 190], [138, 160], [142, 130],
              ].map(([x, y]) => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r="2" />
              ))}
            </g>
          </svg>
          <div className="absolute inset-x-[11%] top-[22%] h-[47%] overflow-hidden rounded-[50%]">
            <div className="animate-scan absolute inset-x-0 h-12 bg-gradient-to-b from-transparent via-emerald-300/25 to-transparent" />
          </div>
          <div className="absolute inset-x-5 bottom-8 flex items-center gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10 backdrop-blur">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-slate-950">
              <Smile className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Acción 2 de 3</p>
              <p className="text-sm font-semibold text-white">Sonríe</p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-2/3 rounded-full bg-emerald-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tarjetas flotantes */}
      <div className="animate-float absolute -left-2 top-16 flex items-center gap-2.5 rounded-2xl bg-slate-900/90 px-3.5 py-2.5 shadow-xl ring-1 ring-white/10 backdrop-blur sm:-left-10">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
          <Eye className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-semibold text-white">Prueba de vida</p>
          <p className="text-[11px] text-emerald-300">Superada</p>
        </div>
      </div>
      <div className="animate-float absolute -right-2 top-1/2 flex items-center gap-2.5 rounded-2xl bg-slate-900/90 px-3.5 py-2.5 shadow-xl ring-1 ring-white/10 backdrop-blur [animation-delay:1.5s] sm:-right-8">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-cyan-400/15 text-cyan-300">
          <CreditCard className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-semibold text-white">Documento</p>
          <p className="text-[11px] text-cyan-300">Foto detectada</p>
        </div>
      </div>
      <div className="animate-float absolute -bottom-4 left-4 flex items-center gap-3 rounded-2xl bg-slate-900/90 px-4 py-3 shadow-xl ring-1 ring-emerald-400/30 backdrop-blur [animation-delay:3s] sm:-left-4">
        <ShieldCheck className="h-6 w-6 text-emerald-300" />
        <div>
          <p className="text-xs text-slate-400">Coincidencia</p>
          <p className="text-lg font-bold text-white">97.8%</p>
        </div>
      </div>
    </div>
  );
}
