import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// HTTPS를 껐다 켰다 하고 싶으면 NO_HTTPS=1 npm run dev
const useHttps = !process.env.NO_HTTPS

// GitHub Pages는 사이트를 /<repo>/ 하위 경로에서 서빙하므로
// 빌드 시 BASE_PATH 환경변수로 base를 넣어준다. (개발 서버는 그냥 '/')
const base = process.env.BASE_PATH || '/'

export default defineConfig({
  base,
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
