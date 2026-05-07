import { messages } from "@/i18n/messages";

const getMessage = (locale, path) => {
	if (!path) return "";
	const parts = path.split(".");
	let result = messages[locale] || messages.vi;
	for (const part of parts) {
		if (result && Object.prototype.hasOwnProperty.call(result, part)) {
			result = result[part];
		} else {
			return null;
		}
	}
	return typeof result === "string" ? result : null;
};

const formatMessage = (message, params) => {
	if (!params || typeof message !== "string") {
		return message;
	}
	return message.replace(/\{(\w+)\}/g, (_, key) => {
		return params[key] !== undefined ? params[key] : `{${key}}`;
	});
};

export default {
	install(app, options = {}) {
		const store = options.store;

		const translate = (key, params, fallback) => {
			let interpolation = undefined;
			let localFallback = fallback;

			if (
				params &&
				typeof params === "object" &&
				!Array.isArray(params)
			) {
				interpolation = params;
			} else if (params !== undefined) {
				localFallback = params;
			}

			const locale =
				store?.state?.settings?.general?.language?.toLowerCase() === "en"
					? "en"
					: "vi";
			const message = getMessage(locale, key) ?? localFallback ?? key;
			return formatMessage(message, interpolation);
		};

		app.config.globalProperties.$t = function (key, params, fallback) {
			return translate(key, params, fallback);
		};

		app.provide("t", translate);
	},
};
