/**
 * Utility helpers shared across the frontend.
 * These functions keep Vue components agnostic from backend casing/structures.
 */

export const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);

const parseJSON = (value, fallback = []) => {
	try {
		if (typeof value === "string") {
			return JSON.parse(value);
		}
		return Array.isArray(value) ? value : fallback;
	} catch (err) {
		console.warn("Failed to parse JSON field:", value, err);
		return fallback;
	}
};

const toCamel = (key = "") =>
	key
		.replace(/([-_][a-z])/gi, (group) => group.toUpperCase().replace("-", "").replace("_", ""))
		.replace(/^[A-Z]/, (str) => str.toLowerCase());

const toAbsoluteUrl = (value) => {
	if (!value) return value;
	if (/^https?:\/\//i.test(value)) return value;
	if (value.startsWith("/")) return `${API_ORIGIN}${value}`;
	return value;
};

/**
 * Recursively convert object keys to camelCase.
 */
export const camelizeKeys = (value) => {
	if (Array.isArray(value)) {
		return value.map(camelizeKeys);
	}

	if (!isObject(value)) {
		return value;
	}

	return Object.keys(value).reduce((acc, key) => {
		acc[toCamel(key)] = camelizeKeys(value[key]);
		return acc;
	}, {});
};

export const normalizeLink = (raw = {}) => {
	const link = camelizeKeys(raw);
	const normalized = {
		id: link.id ?? null,
		title: link.title ?? "",
		shortUrl: link.shortUrl ?? "",
		originalUrl: link.originalUrl ?? link.url ?? "",
		customSlug: link.customSlug ?? "",
		category: link.category ?? "",
		tags: parseJSON(link.tags, []),
		description: link.description ?? "",
		visibility: link.visibility ?? "public",
		visits: link.visits ?? 0,
		userId: link.userId ?? null,
		createdAt: link.createdAt ?? null,
		updatedAt: link.updatedAt ?? null,
	};
	return {
		...normalized,
		Title: normalized.title,
		ShortUrl: normalized.shortUrl,
		OriginalUrl: normalized.originalUrl,
		CustomSlug: normalized.customSlug,
		Category: normalized.category,
		Tags: normalized.tags,
		Description: normalized.description,
		Visibility: normalized.visibility,
		Visits: normalized.visits,
		CreatedAt: normalized.createdAt,
		UpdatedAt: normalized.updatedAt,
	};
};

export const normalizeFile = (raw = {}) => {
	const file = camelizeKeys(raw);
	const normalized = {
		id: file.id ?? null,
		name: file.name ?? "",
		type: file.type ?? "other",
		size: file.size ?? "",
		category: file.category ?? "",
		tags: parseJSON(file.tags, []),
		url: toAbsoluteUrl(file.url ?? ""),
		driveFileId: file.driveFileId ?? null,
		description: file.description ?? "",
		userId: file.userId ?? null,
		createdAt: file.createdAt ?? null,
		updatedAt: file.updatedAt ?? null,
	};
	return {
		...normalized,
		Name: normalized.name,
		Type: normalized.type,
		Size: normalized.size,
		Category: normalized.category,
		Tags: normalized.tags,
		Url: normalized.url,
		DriveFileId: normalized.driveFileId,
		Description: normalized.description,
		CreatedAt: normalized.createdAt,
		UpdatedAt: normalized.updatedAt,
	};
};

export const mapLinks = (data = []) => data.map(normalizeLink);
export const mapFiles = (data = []) => data.map(normalizeFile);

export const getLinkSlug = (link = {}) => {
	if (!link) return null;
	if (link.customSlug) return link.customSlug;
	const shortUrl = link.shortUrl || link.ShortUrl;
	if (!shortUrl) return null;
	const cleaned = shortUrl.replace(/^https?:\/\//i, "");
	const parts = cleaned.split("/");
	return parts.filter(Boolean).pop() || null;
};

export const getLinkRedirectUrl = (link = {}) => {
	const slug = getLinkSlug(link);
	if (!slug) {
		return link.originalUrl || link.OriginalUrl || null;
	}
	return `${API_ORIGIN}/api/links/redirect/${slug}`;
};

export const getFileDownloadUrl = (fileOrId) => {
	const id = typeof fileOrId === "object" ? fileOrId?.id : fileOrId;
	return id ? `${API_ORIGIN}/api/files/download/${id}` : null;
};

export const pick = (obj = {}, keys = []) =>
	keys.reduce((acc, key) => {
		if (Object.prototype.hasOwnProperty.call(obj, key)) {
			acc[key] = obj[key];
		}
		return acc;
	}, {});

export const formatDate = (date, locale = "vi-VN") => {
	if (!date) return "";
	const dt = typeof date === "string" ? new Date(date) : date;
	return Number.isNaN(dt.getTime())
		? ""
		: dt.toLocaleString(locale, { hour12: false });
};

export default {
	API_ORIGIN,
	isObject,
	parseJSON,
	toCamel,
	camelizeKeys,
	normalizeLink,
	normalizeFile,
	mapLinks,
	mapFiles,
	getLinkSlug,
	getLinkRedirectUrl,
	getFileDownloadUrl,
	pick,
	formatDate,
};
