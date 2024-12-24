import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite configuration
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // You can change this port if necessary
  },
  build: {
    outDir: "dist", // Output directory for production build
    sourcemap: true, // Useful for debugging
  },
});
