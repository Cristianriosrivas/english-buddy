import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { SerwistProvider } from "@serwist/turbopack/react";
import { OfflineBanner } from "@/components/pwa/pwa";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: {
    default: "English Buddy",
    template: "%s · English Buddy",
  },
  description: "Practica inglés hablando y escribiendo con tu amiga de IA.",
  applicationName: "English Buddy",
  // iPhone: abrir como app (sin la barra de Safari) al agregarla a la pantalla de inicio
  appleWebApp: { capable: true, title: "English Buddy", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7fd" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a18" },
  ],
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div aria-hidden className="bg-aurora" />
          {/* Service worker de la PWA; en desarrollo se desactiva para no guardar versiones viejas */}
          <SerwistProvider
            swUrl="/serwist/sw.js"
            disable={process.env.NODE_ENV === "development"}
            cacheOnNavigation
            reloadOnOnline={false}
          >
            {children}
          </SerwistProvider>
          <OfflineBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
