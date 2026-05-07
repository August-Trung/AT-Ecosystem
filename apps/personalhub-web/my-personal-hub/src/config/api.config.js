export const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export default {
	// Base URL cua ASP.NET Web API
	baseURL: API_ORIGIN,

	// Timeout
	timeout: 10000,

	// API Endpoints
	endpoints: {
		// Auth
		login: "/api/auth/login",
		register: "/api/auth/register",
		me: "/api/auth/me",

		// Links
		links: "/api/links",
		linkById: (id) => `/api/links/${id}`,
		linksByCategory: (category) => `/api/links/category/${category}`,
		checkSlug: (slug) => `/api/links/check-slug/${slug}`,

		// Files
		files: "/api/files",
		fileById: (id) => `/api/files/${id}`,
		filesByCategory: (category) => `/api/files/category/${category}`,
		uploadFile: "/api/files/upload",
		fileDownload: (id) => `/api/files/download/${id}`,

		// Statistics
		statistics: "/api/statistics",
		topLinks: "/api/statistics/links/top",
		recentActivities: "/api/statistics/activities/recent",
	},
};
