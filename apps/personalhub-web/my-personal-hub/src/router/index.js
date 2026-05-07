import { createRouter, createWebHistory } from "vue-router";
import MainLayout from "@/components/layout/MainLayout.vue";
import store from "@/store";

const Dashboard = () => import("@/views/Dashboard.vue");
const LinkManager = () => import("@/views/LinkManager.vue");
const FileManager = () => import("@/views/FileManager.vue");
const ITSupport = () => import("@/views/ITSupport.vue");
const Tester = () => import("@/views/Tester.vue");
const WebProjects = () => import("@/views/WebProjects.vue");
const Media = () => import("@/views/Media.vue");
const Profile = () => import("@/views/Profile.vue");
const Settings = () => import("@/views/Settings.vue");
const Login = () => import("@/views/auth/Login.vue");
const Register = () => import("@/views/auth/Register.vue");
const AuthCallback = () => import("@/views/auth/AuthCallback.vue");

const getToken = () => {
	if (typeof window === "undefined") return null;
	return (
		window.localStorage.getItem("token") ||
		window.sessionStorage.getItem("token")
	);
};

const routes = [
	{
		path: "/login",
		name: "Login",
		component: Login,
		meta: { title: "Đăng nhập", guest: true },
	},
	{
		path: "/auth/callback",
		name: "AuthCallback",
		component: AuthCallback,
		meta: { title: "Đang xác thực", guest: true },
	},
	{
		path: "/register",
		name: "Register",
		component: Register,
		meta: { title: "Đăng ký", guest: true },
	},
	{
		path: "/",
		component: MainLayout,
		meta: { requiresAuth: true },
		children: [
			{
				path: "",
				name: "Dashboard",
				component: Dashboard,
				meta: { title: "Dashboard" },
			},
			{
				path: "links",
				name: "LinkManager",
				component: LinkManager,
				meta: { title: "Quản lý Link" },
			},
			{
				path: "files",
				name: "FileManager",
				component: FileManager,
				meta: { title: "Quản lý File" },
			},
			{
				path: "it-support",
				name: "ITSupport",
				component: ITSupport,
				meta: { title: "IT Support", category: "IT Support" },
			},
			{
				path: "tester",
				name: "Tester",
				component: Tester,
				meta: { title: "Tester", category: "Tester" },
			},
			{
				path: "web-projects",
				name: "WebProjects",
				component: WebProjects,
				meta: { title: "Web Projects", category: "Web" },
			},
			{
				path: "media",
				name: "Media",
				component: Media,
				meta: { title: "Media", category: "Media" },
			},
			{
				path: "profile",
				name: "Profile",
				component: Profile,
				meta: { title: "Hồ sơ" },
			},
			{
				path: "settings",
				name: "Settings",
				component: Settings,
				meta: { title: "Cài đặt" },
			},
		],
	},
];

const router = createRouter({
	history: createWebHistory(),
	routes,
});

router.beforeEach(async (to, from, next) => {
	document.title = to.meta.title
		? `${to.meta.title} - My File Hub`
		: "My File Hub";

	const requiresAuth = to.matched.some((record) => record.meta?.requiresAuth);
	const isGuestOnly = to.matched.some((record) => record.meta?.guest);
	const token = getToken();

	if (requiresAuth && !token) {
		return next({
			name: "Login",
			query: { redirect: to.fullPath },
		});
	}

	if (isGuestOnly && token) {
		return next({ name: "Dashboard" });
	}

	if (token && !store.state.user) {
		try {
			await store.dispatch("fetchCurrentUser");
		} catch (error) {
			await store.dispatch("logout");
			return next({ name: "Login" });
		}
	}

	next();
});

export default router;
