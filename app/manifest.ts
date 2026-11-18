import type { MetadataRoute } from "next";

/** Manifest de la PWA: permite instalar la app y abrirla sin la barra del navegador */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "English Buddy",
    short_name: "English Buddy",
    description: "Practica inglés hablando y escribiendo con Emma, tu amiga nativa con IA.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f3ff",
    theme_color: "#8b5cf6",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
