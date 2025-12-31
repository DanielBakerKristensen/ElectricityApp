import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
        plugins: [react()],
        server: {
            port: 3000,
            proxy: {
                '/api': {
                    target: env.VITE_API_URL || 'http://localhost:5000',
                    changeOrigin: true,
                },
            },
        },
        build: {
            outDir: 'build',
            rollupOptions: {
                output: {
                    manualChunks: {
                        vendor: ['react', 'react-dom', 'react-router-dom'],
                        mui: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
                        charts: ['apexcharts', 'react-apexcharts'],
                    },
                },
            },
        },
        test: {
            globals: true,
            environment: 'jsdom',
            setupFiles: './src/setupTests.js',
            css: true,
        },
    };
});
