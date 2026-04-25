import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  if (mode === "production" && process.env.VITE_DEV_MODE === "true") {
    throw new Error("FATAL: VITE_DEV_MODE=true is not allowed in production builds");
  }

  return {
    plugins: [tailwindcss(), react()],
    server: {
      proxy: {
        "/api": "http://localhost:3000",
      },
    },
  };
});
