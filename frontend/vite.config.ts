import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // "/" for a custom domain; "/<repo>/" when served from <user>.github.io/<repo>/
  base: process.env.VITE_BASE ?? '/',
  server: { host: true },
});
