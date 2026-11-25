// Static SPA build for cPanel hosting (no Node/SSR). Output: .output/public (index.html + assets).
// Run: VITE_USE_MOCK=false VITE_API_BASE=/api/v1 npm run build:cpanel
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    spa: { enabled: true },
  },
  nitro: false,
} as never);
