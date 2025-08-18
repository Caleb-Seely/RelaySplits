import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimize bundle size
    target: 'es2020',
    minify: 'esbuild', // Use esbuild instead of terser
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
          ],
          'utils-vendor': [
            'date-fns',
            'dayjs',
            'zod',
            'zustand',
            '@tanstack/react-query',
          ],
          'supabase-vendor': ['@supabase/supabase-js'],
          'form-vendor': [
            'react-hook-form',
            '@hookform/resolvers',
          ],
          'chart-vendor': ['recharts'],
          'file-vendor': ['papaparse', 'xlsx'],
        },
        // Optimize chunk naming
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || [];
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `images/[name]-[hash][extname]`;
          }
          if (/css/i.test(ext)) {
            return `css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
      },
    },
    // Optimize chunk size warnings
    chunkSizeWarningLimit: 1000, // Increase limit to 1MB
    // Enable source maps for debugging
    sourcemap: mode === 'development',
  },
  optimizeDeps: {
    // Pre-bundle dependencies for faster dev server
    include: [
      'react',
      'react-dom',
      '@supabase/supabase-js',
      'zustand',
      '@tanstack/react-query',
      'date-fns',
      'zod',
    ],
    // Exclude problematic dependencies
    exclude: ['@sentry/react'], // Exclude Sentry from pre-bundling
  },
  // Performance optimizations
  esbuild: {
    // Remove console.log in production
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
}));
