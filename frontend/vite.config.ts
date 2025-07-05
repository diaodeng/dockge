import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import Components from "unplugin-vue-components/vite";
import { BootstrapVueNextResolver } from "unplugin-vue-components/resolvers";
import viteCompression from "vite-plugin-compression";
import AutoImport from "unplugin-auto-import/vite";
import "vue";
import { resolve } from 'path';

const viteCompressionFilter = /\.(js|mjs|json|css|html|svg)$/i;

// https://vitejs.dev/config/
export default defineConfig({
    server: {
        port: 5000,
    },
    define: {
        "FRONTEND_VERSION": JSON.stringify(process.env.npm_package_version),
    },
    root: "./frontend",
    build: {
        outDir: "../frontend-dist",
    },
    plugins: [
        AutoImport({
            imports: [ "vue", "vue-router", "vue/macros" ],
            vueTemplate: true,
            dts: "src/auto-imports.d.ts",
            eslintrc: {
                enabled: true,
                filepath: resolve(__dirname, "../.eslintrc-auto-import.json"),
                globalsPropValue: true,
            },
        }),
        vue(),
        Components({
            resolvers: [ BootstrapVueNextResolver() ],
        }),
        viteCompression({
            algorithm: "gzip",
            filter: viteCompressionFilter,
        }),
        viteCompression({
            algorithm: "brotliCompress",
            filter: viteCompressionFilter,
        }),
    ],
});
