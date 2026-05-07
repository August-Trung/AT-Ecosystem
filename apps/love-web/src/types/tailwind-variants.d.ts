declare module "tailwind-variants" {
	export function tv<T extends Record<string, any>>(
		input: any
	): (options?: any) => string;
}
