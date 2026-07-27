import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    cors: true, // 👈 Cross-Origin Requests allow ചെയ്യാൻ
    headers: {
      'Access-Control-Allow-Origin': '*', // 👈 Ngrok അസറ്റുകൾ block ചെയ്യാതിരിക്കാൻ
    },
  },
});