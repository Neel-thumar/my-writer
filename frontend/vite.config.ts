import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // API_TARGET lets a second copy of the app run against another backend
      "/api": process.env.API_TARGET ?? "http://localhost:8000",
    },
  },
});
