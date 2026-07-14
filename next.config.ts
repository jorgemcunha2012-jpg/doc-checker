import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/developments/extract": [
      "./node_modules/tesseract.js/src/worker-script/node/**/*",
      "./node_modules/tesseract.js/src/worker-script/**/*",
      "./node_modules/tesseract.js/src/worker/node/**/*",
      "./node_modules/tesseract.js/src/**/*",
      "./node_modules/tesseract.js-core/**/*",
      "./node_modules/regenerator-runtime/**/*",
      "./node_modules/is-url/**/*",
    ],
    "/api/validation-processes": [
      "./node_modules/tesseract.js/src/worker-script/node/**/*",
      "./node_modules/tesseract.js/src/worker-script/**/*",
      "./node_modules/tesseract.js/src/worker/node/**/*",
      "./node_modules/tesseract.js/src/**/*",
      "./node_modules/tesseract.js-core/**/*",
      "./node_modules/regenerator-runtime/**/*",
      "./node_modules/is-url/**/*",
    ],
  },
  typedRoutes: true,
};

export default nextConfig;
