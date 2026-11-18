import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandLogo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <Link
      href="/"
      className={cn(
        "flex items-center gap-2 font-bold tracking-tight",
        size === "lg" ? "text-3xl" : "text-lg",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-sky-400 text-white shadow-lg shadow-violet-500/30",
          size === "lg" ? "h-12 w-12 text-2xl" : "h-8 w-8 text-base",
        )}
      >
        EB
      </span>
      <span>
        English <span className="text-primary">Buddy</span>
      </span>
    </Link>
  );
}
