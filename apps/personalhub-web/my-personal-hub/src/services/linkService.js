import api from "./api";

export default {
	// Link APIs
	getLinks(params) {
		return api.get("/links", { params });
	},

	getLinkById(id) {
		return api.get(`/links/${id}`);
	},

	createLink(data) {
		return api.post("/links", data);
	},

	updateLink(id, data) {
		return api.put(`/links/${id}`, data);
	},

	deleteLink(id) {
		return api.delete(`/links/${id}`);
	},

	checkSlug(slug) {
		return api.get(`/links/check-slug/${slug}`);
	},

	// File APIs
	getFiles(params) {
		return api.get("/files", { params });
	},

	getFileById(id) {
		return api.get(`/files/${id}`);
	},

	uploadFile(formData) {
		return api.post("/files/upload", formData, {
			headers: {
				"Content-Type": "multipart/form-data",
			},
		});
	},

	deleteFile(id) {
		return api.delete(`/files/${id}`);
	},

	// Statistics APIs
	getStatistics() {
		return api.get("/statistics");
	},

	// Category APIs
	getLinksByCategory(category) {
		return api.get(`/links/category/${category}`);
	},

	getFilesByCategory(category) {
		return api.get(`/files/category/${category}`);
	},
};
