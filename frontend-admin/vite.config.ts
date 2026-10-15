import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true },
  preview: { port: 4174, strictPort: true },
  test: { environment: 'jsdom', setupFiles: ['./src/tests/setup.ts'], restoreMocks: true },
})
