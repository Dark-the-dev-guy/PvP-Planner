import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "./frontend", // Define the frontend as the root
  plugins: [react()],
  build: {
    outDir: "../dist", // Place the build output in `dist` folder
    sourcemap: true,
  },
});
