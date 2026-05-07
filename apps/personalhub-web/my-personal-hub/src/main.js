import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";
import Antd from "ant-design-vue";
import "ant-design-vue/dist/reset.css";
import i18n from "./plugins/i18n";

const app = createApp(App);

app.use(router);
app.use(store);
app.use(Antd);
app.use(i18n, { store });

app.mount("#app");
