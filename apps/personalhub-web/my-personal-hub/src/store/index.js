import { createStore } from "vuex";
import linkService from "../services/linkService";
import fileService from "../services/fileService";
import authService from "../services/authService";
import {
	mapLinks,
	mapFiles,
	normalizeLink,
	normalizeFile,
} from "../utils/helpers";

const SETTINGS_STORAGE_KEY = "app_settings";
const TOKEN_STORAGE_KEY = "token";

const hasWindow = typeof window !== "undefined";

const getStoredToken = () => {
	if (!hasWindow) return null;
	return (
		window.localStorage.getItem(TOKEN_STORAGE_KEY) ||
		window.sessionStorage.getItem(TOKEN_STORAGE_KEY)
	);
};

const persistToken = (token, remember = true) => {
	if (!hasWindow) return;
	if (!token) {
		window.localStorage.removeItem(TOKEN_STORAGE_KEY);
		window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
		return;
	}

	if (remember) {
		window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
		window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
	} else {
		window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
		window.localStorage.removeItem(TOKEN_STORAGE_KEY);
	}
};

const defaultSettings = () => ({
	general: {
		language: "vi",
		rememberLogin: true,
	},
	appearance: {
		theme: "light",
		density: "comfortable",
		primaryColor: "#1890ff",
		fontSize: "normal",
	},
	preferences: {
		sidebarCollapsed: false,
		landingPage: "Dashboard",
	},
});

const deepMerge = (target = {}, source = {}) => {
	const output = { ...target };
	Object.keys(source || {}).forEach((key) => {
		const sourceValue = source[key];
		const targetValue = target[key];
		if (
			sourceValue &&
			typeof sourceValue === "object" &&
			!Array.isArray(sourceValue)
		) {
			output[key] = deepMerge(
				targetValue && typeof targetValue === "object" ? targetValue : {},
				sourceValue
			);
		} else {
			output[key] = sourceValue;
		}
	});
	return output;
};

const loadSettingsFromStorage = () => {
	if (typeof window === "undefined") return defaultSettings();
	try {
		const saved = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
		if (saved) {
			const parsed = JSON.parse(saved);
			return deepMerge(defaultSettings(), parsed);
		}
	} catch (error) {
		console.warn("Failed to load settings:", error);
	}
	return defaultSettings();
};

const saveSettingsToStorage = (settings) => {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(
			SETTINGS_STORAGE_KEY,
			JSON.stringify(settings)
		);
	} catch (error) {
		console.warn("Failed to save settings:", error);
	}
};

export default createStore({
	state: {
		user: null,
		token: getStoredToken(),
		authProviders: null,
		links: [],
		files: [],
		loading: false,
		searchKeyword: "",
		selectedTags: [],
		settings: loadSettingsFromStorage(),
	},

	mutations: {
		SET_USER(state, user) {
			state.user = user;
		},
		SET_TOKEN(state, token) {
			state.token = token;
			const remember =
				state.settings?.general?.rememberLogin ?? true;
			persistToken(token, remember);
		},
		SET_LINKS(state, links) {
			state.links = links;
		},
		SET_AUTH_PROVIDERS(state, providers) {
			state.authProviders = providers;
		},
		ADD_LINK(state, link) {
			state.links.unshift(link);
		},
		UPDATE_LINK(state, updatedLink) {
			const index = state.links.findIndex((l) => l.id === updatedLink.id);
			if (index !== -1) {
				state.links.splice(index, 1, updatedLink);
			}
		},
		DELETE_LINK(state, linkId) {
			state.links = state.links.filter((l) => l.id !== linkId);
		},
		SET_FILES(state, files) {
			state.files = files;
		},
		ADD_FILE(state, file) {
			state.files.unshift(file);
		},
		DELETE_FILE(state, fileId) {
			state.files = state.files.filter((f) => f.id !== fileId);
		},
		UPDATE_FILE(state, updatedFile) {
			const index = state.files.findIndex((f) => f.id === updatedFile.id);
			if (index !== -1) {
				state.files.splice(index, 1, updatedFile);
			}
		},
		SET_LOADING(state, loading) {
			state.loading = loading;
		},
		SET_SEARCH_KEYWORD(state, keyword) {
			state.searchKeyword = keyword;
		},
		SET_SELECTED_TAGS(state, tags) {
			state.selectedTags = tags;
		},
		SET_SETTINGS(state, settings) {
			state.settings = settings;
			saveSettingsToStorage(settings);
			const remember = settings?.general?.rememberLogin ?? true;
			if (state.token) {
				persistToken(state.token, remember);
			}
		},
	},

	actions: {
		async loadSettings({ commit }) {
			commit("SET_SETTINGS", loadSettingsFromStorage());
		},
		async updateSettings({ state, commit }, payload) {
			const merged = deepMerge(state.settings, payload);
			commit("SET_SETTINGS", merged);
			return merged;
		},
		async register({ commit }, payload) {
			const response = await authService.register(payload);
			if (response.success) {
				commit("SET_USER", response.data.user);
				commit("SET_TOKEN", response.data.token);
			}
			return response;
		},
		async fetchAuthProviders({ commit }) {
			const response = await authService.getProviders();
			if (response.success) {
				commit("SET_AUTH_PROVIDERS", response.data);
			}
			return response;
		},
		async login({ commit }, payload) {
			const response = await authService.login(payload);
			if (response.success) {
				commit("SET_USER", response.data.user);
				commit("SET_TOKEN", response.data.token);
			}
			return response;
		},
		async loginWithGoogle({ commit }, credential) {
			const response = await authService.loginWithGoogle(credential);
			if (response.success) {
				commit("SET_USER", response.data.user);
				commit("SET_TOKEN", response.data.token);
			}
			return response;
		},
		getGitHubStartUrl(_, returnUrl) {
			return authService.getGitHubStartUrl(returnUrl);
		},
		async requestPhoneOtp(_, payload) {
			return authService.requestPhoneOtp(payload);
		},
		async verifyPhoneOtp({ commit }, payload) {
			const response = await authService.verifyPhoneOtp(payload);
			if (response.success) {
				commit("SET_USER", response.data.user);
				commit("SET_TOKEN", response.data.token);
			}
			return response;
		},
		async fetchCurrentUser({ commit, state }) {
			if (!state.token) return null;
			try {
				const response = await authService.getCurrentUser();
				commit("SET_USER", response.data);
				return response.data;
			} catch (error) {
				commit("SET_USER", null);
				commit("SET_TOKEN", null);
				throw error;
			}
		},
		async updateProfile({ commit }, payload) {
			const response = await authService.updateProfile(payload);
			if (response.success) {
				commit("SET_USER", response.data);
			}
			return response;
		},
		async changePassword(_, payload) {
			return authService.changePassword(payload);
		},
		async logout({ commit }) {
			commit("SET_USER", null);
			commit("SET_TOKEN", null);
			commit("SET_LINKS", []);
			commit("SET_FILES", []);
		},
		async fetchLinks({ commit }, filters = {}) {
			commit("SET_LOADING", true);
			try {
				const response = await linkService.getLinks(filters);
				const links = mapLinks(response.data || []);
				commit("SET_LINKS", links);
				return response;
			} catch (error) {
				console.error("Error fetching links:", error);
				commit("SET_LINKS", []);
				throw error;
			} finally {
				commit("SET_LOADING", false);
			}
		},

		async fetchFiles({ commit }, filters = {}) {
			commit("SET_LOADING", true);
			try {
				const response = await fileService.getFiles(filters);
				const files = mapFiles(response.data || []);
				commit("SET_FILES", files);
				return response;
			} catch (error) {
				console.error("Error fetching files:", error);
				commit("SET_FILES", []);
				throw error;
			} finally {
				commit("SET_LOADING", false);
			}
		},

		async createLink({ commit }, linkData) {
			try {
				const response = await linkService.createLink(linkData);
				if (response.success) {
					commit("ADD_LINK", normalizeLink(response.data));
				}
				return response;
			} catch (error) {
				console.error("Error creating link:", error);
				throw error;
			}
		},

		async updateLink({ commit }, { id, data }) {
			try {
				const response = await linkService.updateLink(id, data);
				if (response.success) {
					commit("UPDATE_LINK", normalizeLink(response.data));
				}
				return response;
			} catch (error) {
				console.error("Error updating link:", error);
				throw error;
			}
		},

		async deleteLink({ commit }, id) {
			try {
				const response = await linkService.deleteLink(id);
				if (response.success) commit("DELETE_LINK", id);
				return response;
			} catch (error) {
				console.error("Error deleting link:", error);
				throw error;
			}
		},

		async uploadFile({ commit }, payload) {
			try {
				const formData =
					payload instanceof FormData ? payload : payload?.formData;
				const config = payload?.config || {};
				const response = await fileService.uploadFile(formData, config);
				if (response.success)
					commit("ADD_FILE", normalizeFile(response.data));
				return response;
			} catch (error) {
				console.error("Error uploading file:", error);
				throw error;
			}
		},

		async updateFile({ commit }, { id, data }) {
			try {
				const response = await fileService.updateFile(id, data);
				if (response.success) {
					commit("UPDATE_FILE", normalizeFile(response.data));
				}
				return response;
			} catch (error) {
				console.error("Error updating file:", error);
				throw error;
			}
		},

		async deleteFile({ commit }, id) {
			try {
				const response = await fileService.deleteFile(id);
				if (response.success) commit("DELETE_FILE", id);
				return response;
			} catch (error) {
				console.error("Error deleting file:", error);
				throw error;
			}
		},

		async downloadFile(_, id) {
			try {
				const blob = await fileService.downloadFile(id);
				const url = window.URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = `file_${id}`;
				a.click();
				a.remove();
				window.URL.revokeObjectURL(url);
			} catch (error) {
				console.error("Error downloading file:", error);
			}
		},
	},

	getters: {
		filteredLinks: (state) => {
			let filtered = state.links;

			if (state.searchKeyword) {
				filtered = filtered.filter(
					(link) =>
						(link.title &&
							link.title
								.toLowerCase()
								.includes(state.searchKeyword.toLowerCase())) ||
						(link.shortUrl &&
							link.shortUrl
								.toLowerCase()
								.includes(state.searchKeyword.toLowerCase()))
				);
			}

			if (state.selectedTags.length > 0) {
				filtered = filtered.filter((link) => {
					const tags = link.tags || [];
					return tags.some((tag) => state.selectedTags.includes(tag));
				});
			}

			return filtered;
		},

		filteredFiles: (state) => {
			let filtered = state.files;

			if (state.searchKeyword) {
				filtered = filtered.filter(
					(file) =>
						file.name &&
						file.name
							.toLowerCase()
							.includes(state.searchKeyword.toLowerCase())
				);
			}

			if (state.selectedTags.length > 0) {
				filtered = filtered.filter((file) => {
					const tags = file.tags || [];
					return tags.some((tag) => state.selectedTags.includes(tag));
				});
			}

			return filtered;
		},

		getLinksByCategory: (state) => (category) =>
			state.links.filter((link) => link.category === category),

		getFilesByCategory: (state) => (category) =>
			state.files.filter((file) => file.category === category),
	},
});
