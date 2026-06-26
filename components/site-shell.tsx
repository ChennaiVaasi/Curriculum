import Link from "next/link";
import type { ReactNode } from "react";

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f2ebdc_0%,#f8f4ec_32%,#fbfaf7_100%)] text-stone-900">
      <header className="border-b border-stone-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-stone-900 text-sm font-semibold text-amber-100">
              64
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">Curriculum</p>
              <p className="text-sm text-stone-500">Chess chapter library and study desk</p>
            </div>
          </Link>

          <nav className="flex items-center gap-3 text-sm">
            <Link className="rounded-full px-4 py-2 text-stone-700 transition hover:bg-stone-100" href="/library">
              Library
            </Link>
            <Link className="rounded-full px-4 py-2 text-stone-700 transition hover:bg-stone-100" href="/upload">
              Upload
            </Link>
            <Link className="rounded-full px-4 py-2 text-stone-700 transition hover:bg-stone-100" href="/settings">
              Settings
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-8">{children}</main>
    </div>
  );
}
