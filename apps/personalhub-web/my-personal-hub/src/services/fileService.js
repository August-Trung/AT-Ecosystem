// src/services/fileService.js
import api from "./api"; // axios instance

export default {
	// 🟢 Lấy danh sách file
	// File APIs
	getFiles(params) {
		return api.get("/files", { params });
	},

	// 🟢 Lấy file theo ID
	getFileById(id) {
		return api.get(`/files/${id}`);
	},

	// 🟢 Lấy file theo danh mục
	getFilesByCategory(category) {
		return api.get(`/files/category/${category}`);
	},

	// 🟢 Upload file (có auth)
	uploadFile(formData, config = {}) {
		return api.post("/files/upload", formData, {
			headers: { "Content-Type": "multipart/form-data" },
			...config,
		});
	},

	// 🟢 Cập nhật metadata
	updateFile(id, data) {
		return api.put(`/files/${id}`, data);
	},

	// 🟢 Xóa file
	deleteFile(id) {
		return api.delete(`/files/${id}`);
	},

	// 🟢 Download file
	downloadFile(id) {
		return api.get(`/files/download/${id}`, { responseType: "blob" });
	},
};
