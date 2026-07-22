import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANTE: O nome aqui deve ser O MESMO nome do seu repositório no GitHub
  // Se o repo chamar "meu-projeto", coloque '/meu-projeto/'
  base: '/flashcardflow/', 
})