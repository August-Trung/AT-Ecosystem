import {
	createATRegistry,
	navigationResult,
	type ATActionInvokeRequest,
	type ATJsonObject,
} from "../../../packages/at-hotkey-sdk/src";

const manifestBase = {
	protocolVersion: "at-actions.v1" as const,
	appId: "mmo-web",
	appName: "MMO Tools",
	appVersion: "0.1.0",
	origin: typeof window === "undefined" ? "" : window.location.origin,
};

const navigate = (route: string) => {
	window.location.hash = route;
};

const getString = (args: ATJsonObject | undefined, key: string) => {
	const value = args?.[key];
	return typeof value === "string" ? value.trim() : "";
};

const withQuery = (route: string, params: Record<string, string>) => {
	const query = new URLSearchParams();
	Object.entries(params).forEach(([key, value]) => {
		if (value.trim()) {
			query.set(key, value);
		}
	});
	const serialized = query.toString();
	return serialized ? `${route}?${serialized}` : route;
};

const registry = createATRegistry(manifestBase)
	.registerAction(
		{
			id: "mmo.openHome",
			title: "Open MMO Tools",
			description: "Open the MMO Tools home/browse view.",
			aliases: ["mmo", "at tools", "mmo tools", "tool hub"],
			route: "/browse",
			permissions: ["navigate"],
			tags: ["navigation"],
		},
		async () => {
			navigate("/browse");
			return navigationResult("/browse", "MMO Tools");
		}
	)
	.registerAction(
		{
			id: "mmo.openQrGenerator",
			title: "Open QR Generator",
			description: "Open the QR generator and optionally seed text/URL content.",
			aliases: ["qr", "qr generator", "tao qr", "ma qr"],
			route: "/qr-gen",
			inputSchema: {
				type: "object",
				properties: {
					text: {
						type: "string",
						description: "Optional text or URL to prefill.",
					},
				},
			},
			permissions: ["navigate"],
			tags: ["qr", "utility"],
		},
		async (request: ATActionInvokeRequest) => {
			const text = getString(request.args, "text");
			const route = withQuery("/qr-gen", text ? { text } : {});
			navigate(route);
			return navigationResult(route, "QR Generator");
		}
	)
	.registerAction(
		{
			id: "mmo.openTempMail",
			title: "Open Temp Mail",
			description: "Open the temporary email tool.",
			aliases: ["temp mail", "tempmail", "mail tam", "email tam"],
			route: "/temp-mail",
			permissions: ["navigate", "network", "user-data"],
			tags: ["mail", "utility"],
		},
		async () => {
			navigate("/temp-mail");
			return navigationResult("/temp-mail", "Temp Mail");
		}
	)
	.registerAction(
		{
			id: "mmo.openJsonFormatter",
			title: "Open JSON Formatter",
			description: "Open the JSON/XML formatter.",
			aliases: ["json", "json formatter", "format json", "dinh dang json"],
			route: "/json-format",
			permissions: ["navigate"],
			tags: ["dev", "utility"],
		},
		async () => {
			navigate("/json-format");
			return navigationResult("/json-format", "JSON Formatter");
		}
	);

const nativePortableToolActions = [
	{ id: "mmo.openHashTool", title: "Open Hash Utilities", route: "/hash", aliases: ["hash", "md5", "sha1", "sha256", "sha512"] },
	{ id: "mmo.openTextTools", title: "Open Text Tools", route: "/text-tools", aliases: ["base64", "url encode", "url decode", "hex encode", "hex decode"] },
	{ id: "mmo.openTimestampTool", title: "Open Timestamp Converter", route: "/timestamp", aliases: ["timestamp", "unix time", "epoch"] },
	{ id: "mmo.openIdGenerator", title: "Open ID Generator", route: "/id-gen", aliases: ["id gen", "uuid gen", "ulid", "nanoid"] },
	{ id: "mmo.openPasswordGenerator", title: "Open Password Generator", route: "/password", aliases: ["password"] },
	{ id: "mmo.openRegexTester", title: "Open Regex Tester", route: "/regex", aliases: ["regex", "regexp"] },
	{ id: "mmo.openListExtractor", title: "Open List Extractor", route: "/extractor", aliases: ["extract email", "extract ip", "extract proxy"] },
	{ id: "mmo.openKeyValueFormatter", title: "Open Key Value Formatter", route: "/kv-line-format", aliases: ["key value", "kv line"] },
	{ id: "mmo.openDiffChecker", title: "Open Diff Checker", route: "/diff", aliases: ["diff", "compare text"] },
	{ id: "mmo.openJsonDiff", title: "Open JSON Diff", route: "/json-diff", aliases: ["json diff", "compare json"] },
	{ id: "mmo.openYamlJson", title: "Open YAML JSON Converter", route: "/yaml-json", aliases: ["yaml", "json yaml"] },
	{ id: "mmo.openSqlFormatter", title: "Open SQL Formatter", route: "/sql-format", aliases: ["sql format", "format sql"] },
	{ id: "mmo.openReadability", title: "Open Readability Analyzer", route: "/readability", aliases: ["readability", "word count"] },
	{ id: "mmo.openKeywordExtractor", title: "Open Keyword Extractor", route: "/keywords", aliases: ["keyword", "keywords"] },
	{ id: "mmo.openSimilarityChecker", title: "Open Similarity Checker", route: "/similarity", aliases: ["similarity", "jaccard"] },
	{ id: "mmo.openUuidTool", title: "Open UUID Validator", route: "/uuid-check", aliases: ["uuid check", "validate uuid"] },
	{ id: "mmo.openJwtTool", title: "Open JWT Tool", route: "/jwt", aliases: ["jwt", "decode jwt"] },
	{ id: "mmo.openJsonSchemaValidator", title: "Open JSON Schema Validator", route: "/json-schema", aliases: ["json schema", "schema validate"] },
	{ id: "mmo.openCanonicalBuilder", title: "Open Canonical Builder", route: "/canonical", aliases: ["canonical", "hreflang"] },
	{ id: "mmo.openUrlShortener", title: "Open URL Shortener", route: "/shorten", aliases: ["shorten", "short url"] },
	{ id: "mmo.openVietQR", title: "Open VietQR Generator", route: "/vietqr", aliases: ["vietqr", "bank qr"] },
	{ id: "mmo.openCryptoConverter", title: "Open Crypto Converter", route: "/crypto", aliases: ["eth", "gwei", "wei"] },
	{ id: "mmo.openUserAgentGenerator", title: "Open User Agent Generator", route: "/ua-gen", aliases: ["user agent", "ua gen"] },
	{ id: "mmo.openCronParser", title: "Open Cron Parser", route: "/cron", aliases: ["cron", "crontab"] },
	{ id: "mmo.openTwoFAGenerator", title: "Open 2FA Generator", route: "/2fa", aliases: ["2fa", "totp"] },
];

nativePortableToolActions.forEach((action) => {
	registry.registerAction(
		{
			...action,
			description: `${action.title}.`,
			permissions: ["navigate"],
			tags: ["utility", "telegram-native"],
		},
		async () => {
			navigate(action.route);
			return navigationResult(action.route, action.title.replace(/^Open /, ""));
		}
	);
});

export const atActionRegistry = registry;

export const bootATActions = () => {
	atActionRegistry.exposeToWindow();
	void atActionRegistry.invokeFromUrl();
};
