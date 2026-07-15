import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
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
      "./node_modules/bmp-js/**/*",
      "./node_modules/idb-keyval/**/*",
      "./node_modules/opencollective-postinstall/**/*",
      "./node_modules/zlibjs/**/*",
      "./node_modules/wasm-feature-detect/**/*",
    ],
    "/api/validation-processes": [
      "./node_modules/tesseract.js/src/worker-script/node/**/*",
      "./node_modules/tesseract.js/src/worker-script/**/*",
      "./node_modules/tesseract.js/src/worker/node/**/*",
      "./node_modules/tesseract.js/src/**/*",
      "./node_modules/tesseract.js-core/**/*",
      "./node_modules/regenerator-runtime/**/*",
      "./node_modules/is-url/**/*",
      "./node_modules/bmp-js/**/*",
      "./node_modules/idb-keyval/**/*",
      "./node_modules/opencollective-postinstall/**/*",
      "./node_modules/zlibjs/**/*",
      "./node_modules/wasm-feature-detect/**/*",
    ],
  },
  typedRoutes: true,
};

export default nextConfig;
