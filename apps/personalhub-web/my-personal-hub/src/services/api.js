import axios from "axios";
import apiConfig, { API_ORIGIN } from "../config/api.config";

const TOKEN_KEY = "token";
const hasWindow = typeof window !== "undefined";
const getToken = () => {
	if (!hasWindow) return null;
	return (
		window.localStorage.getItem(TOKEN_KEY) ||
		window.sessionStorage.getItem(TOKEN_KEY)
	);
};
const clearToken = () => {
	if (!hasWindow) return;
	window.localStorage.removeItem(TOKEN_KEY);
	window.sessionStorage.removeItem(TOKEN_KEY);
};

const apiClient = axios.create({
	baseURL: `${API_ORIGIN}/api`,
	timeout: apiConfig.timeout,
	headers: {
		"Content-Type": "application/json",
	},
});

apiClient.interceptors.request.use(
	(config) => {
		const token = getToken();
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
	(response) => response.data,
	(error) => {
		if (error.response) {
			switch (error.response.status) {
				case 401:
					clearToken();
					window.location.href = "/login";
					break;
				case 403:
					console.error("Forbidden");
					break;
				case 404:
					console.error("Not found");
					break;
				case 500:
					console.error("Server error");
					break;
				default:
					console.error("Error:", error.response.data.message);
			}
		}
		return Promise.reject(error);
	}
);

export default apiClient;
