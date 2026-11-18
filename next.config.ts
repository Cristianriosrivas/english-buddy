import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
};

// Serwist genera el service worker de la PWA (ver app/sw.ts y app/serwist/[path]/route.ts)
export default withSerwist(nextConfig);
