import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Set VITE_BASE_PATH in your GitHub repo secrets/vars, or update manually.
// For a repo at github.com/yourname/crypto-breadth → base: '/crypto-breadth/'
// For a custom domain (e.g. breadth.goldenleafgranit.pl) → base: '/'

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/crypto-breadth/',
})
