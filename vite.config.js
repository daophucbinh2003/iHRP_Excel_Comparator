import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Tên repository của bạn trên GitHub
  base: '/iHRP_Excel_Comparator/',
  plugins: [react()],
  server: { port: 3000 }
})