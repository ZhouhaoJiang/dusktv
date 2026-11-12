import { defineConfig, loadEnv } from 'vite';
import { serverBridge } from './server-bridge.mjs';
import { fileURLToPath } from 'node:url';
const local = path => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig(({ mode }) => ({
  plugins: [serverBridge({ defaultServer: loadEnv(mode, local('./'), 'DUSK_').DUSK_SERVER_URL || '' })],
  esbuild: { tsconfigRaw: JSON.stringify({ compilerOptions: { jsx: 'react-jsx' } }) },
  optimizeDeps: { esbuildOptions: { tsconfigRaw: JSON.stringify({ compilerOptions: { jsx: 'react-jsx' } }) } },
  resolve: {
    alias: [
      { find: '@', replacement: local('../') },
      { find: /^react-native$/, replacement: local('./node_modules/react-native-web/dist/index.js') },
      { find: /^lucide-react-native$/, replacement: local('./node_modules/lucide-react/dist/esm/lucide-react.js') },
      { find: /^expo-linear-gradient$/, replacement: local('./gradient.jsx') },
      { find: /^react$/, replacement: local('./node_modules/react/index.js') },
      { find: /^react\/jsx-runtime$/, replacement: local('./node_modules/react/jsx-runtime.js') },
    ],
    dedupe: ['react', 'react-dom'],
  },
  server: { fs: { allow: [local('../')] } },
}));
