import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-slate-950 shadow-lg shadow-emerald-500/25">
        <ShieldCheck className="h-5 w-5" strokeWidth={2.5} />
      </span>
      <span className="text-lg font-semibold tracking-tight text-white">Veridia</span>
    </Link>
  );
}

const NAV = [
  { href: "/#modulos", label: "Módulos" },
  { href: "/#como-funciona", label: "Cómo funciona" },
  { href: "/#seguridad", label: "Seguridad" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[#050810]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm text-slate-400 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="transition hover:text-white">
              {n.label}
            </Link>
          ))}
        </nav>
        <Link href="/verificacion" className="btn-primary !px-4 !py-2">
          Verificar identidad
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-white/5">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6">
        <Logo />
        <p>Verificación biométrica de identidad · Todo el procesamiento ocurre en tu dispositivo.</p>
      </div>
    </footer>
  );
}
