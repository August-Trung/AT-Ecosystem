import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig({
	plugins: [vue()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	build: {
		sourcemap: false,
		rollupOptions: {
			output: {
				manualChunks: {
					vue: ["vue", "vue-router", "vuex"],
					antd: ["ant-design-vue", "@ant-design/icons-vue"],
					axios: ["axios", "dayjs"],
				},
			},
		},
	},
	server: {
		port: 3000,
	},
});
