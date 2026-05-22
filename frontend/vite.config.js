import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // 必须为 true，配合 package.json 里的 --host
    watch: {
      usePolling: true, // WSL2 下热更新必备
    }
  }
})