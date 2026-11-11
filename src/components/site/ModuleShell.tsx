import Link from "next/link";
import { ArrowLeft, Lock, type LucideIcon } from "lucide-react";
import { SiteFooter, SiteHeader } from "./SiteChrome";

export function ModuleShell({
  eyebrow,
  title,
  description,
  tips,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  tips: { Icon: LucideIcon; text: string }[];
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <div className="grid-bg pointer-events-none absolute inset-0 h-[480px]" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[320px_1fr] lg:py-14">
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Volver al inicio
            </Link>
            <div>
              <p className="text-sm font-medium text-emerald-300">{eyebrow}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{title}</h1>
              <p className="mt-3 text-slate-400">{description}</p>
            </div>
            <ul className="space-y-3">
              {tips.map(({ Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-sm text-slate-300">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5 ring-1 ring-white/10">
                    <Icon className="h-4 w-4 text-emerald-300" />
                  </span>
                  <span className="pt-1.5">{text}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-start gap-3 rounded-2xl bg-emerald-400/5 p-4 text-xs text-emerald-100/80 ring-1 ring-emerald-400/15">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              Las imágenes se procesan localmente en tu navegador. No se envían ni almacenan en ningún servidor.
            </div>
          </aside>
          <section className="min-w-0">{children}</section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
