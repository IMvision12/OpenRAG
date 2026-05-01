import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Dev server proxies /api/* → uvicorn on :8000 so the frontend can use
// relative URLs identically in dev and prod (where FastAPI serves the
// built bundle at the same origin).
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            "/api": {
                target: "http://localhost:8000",
                changeOrigin: true,
            },
        },
    },
});
