import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// HTTPS를 껐다 켰다 하고 싶으면 NO_HTTPS=1 npm run dev
const useHttps = !process.env.NO_HTTPS

export default defineConfig({
  plugins: useHttps ? [basicSsl()] : [],
  server: {
    host: true,   // LAN에서 폰이 붙을 수 있게 0.0.0.0
    port: 5173,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
})
