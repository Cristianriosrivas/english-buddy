import { createSerwistRoute } from "@serwist/turbopack";

// Genera /serwist/sw.js a partir de app/sw.ts. La revisión cambia en cada despliegue
// para que la página sin conexión se actualice.
const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? crypto.randomUUID();

// Con cacheComponents no se exportan dynamic/revalidate (Next 16 no los permite)
export const { generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  swSrc: "app/sw.ts",
  useNativeEsbuild: true,
});
