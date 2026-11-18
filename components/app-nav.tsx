"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, House, MessageCircle, MessagesSquare, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDictionary } from "@/lib/i18n";

const t = getDictionary().nav;

const ITEMS = [
  { href: "/", label: t.home, icon: House },
  { href: "/temas", label: t.topics, icon: MessagesSquare },
  { href: "/libre", label: t.free, icon: MessageCircle },
  { href: "/lecciones", label: t.lessons, icon: BookOpen },
  { href: "/progreso", label: t.progress, icon: TrendingUp },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Navegación superior (escritorio) */
export function TopNav() {
  return <TopNavLinks pathname={usePathname()} />;
}

/** Versión sin sección activa, para mostrar mientras carga la ruta */
export function TopNavLinks({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
      {ITEMS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(pathname, href) ? "page" : undefined}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
            isActive(pathname, href) && "bg-primary/10 font-medium text-primary",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** Barra inferior (celular) */
export function BottomNav() {
  return <BottomNavLinks pathname={usePathname()} />;
}

export function BottomNavLinks({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Principal"
      className="glass fixed inset-x-3 bottom-3 z-40 rounded-2xl pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground transition-colors",
                  active && "font-medium text-primary",
                )}
              >
                <Icon className={cn("h-5 w-5 transition-transform", active && "scale-110")} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
