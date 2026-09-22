import path from "node:path";

import type {
  NextConfig,
} from "next";

const nextConfig: NextConfig = {
  /*
   * Produce a self-contained Node.js
   * server that Electron can bundle
   * and start in production.
   */
  output: "standalone",

  /*
   * The web application lives inside
   * a monorepo. Trace dependencies
   * from the repository root so the
   * standalone build includes files
   * required outside apps/web.
   */
  outputFileTracingRoot: path.resolve(
    process.cwd(),
    "../..",
  ),
};

export default nextConfig;