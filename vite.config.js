import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Đặt là '/' để chạy đúng trên Vercel
  base: '/',
  plugins: [react()],
  server: { port: 3000 }
})