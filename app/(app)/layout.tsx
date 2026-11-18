import { BrandLogo } from "@/components/brand-logo";
import { Suspense } from "react";
import { TopNav, TopNavLinks, BottomNav, BottomNavLinks } from "@/components/app-nav";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { LogoutButton } from "@/components/logout-button";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh">
      <header className="glass sticky top-0 z-40 rounded-none border-x-0 border-t-0">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <BrandLogo />
          <Suspense fallback={<TopNavLinks pathname="" />}>
            <TopNav />
          </Suspense>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 md:pb-12">{children}</main>
      <Suspense fallback={<BottomNavLinks pathname="" />}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
