import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from the root of its own subdomain (https://plantas.marioconti.com.ar/), so `base` is '/'.
// If it ever goes back to https://<user>.github.io/plantas/, `base` must become '/plantas/'
// or the built assets are requested from the wrong path and the page renders blank.
export default defineConfig({
  plugins: [react()],
  base: '/',
})
