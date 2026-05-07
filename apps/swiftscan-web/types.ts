export type ImageFilter = "none" | "bw" | "magic" | "grayscale";
export type ScanMode = "document" | "idcard";

export interface CropArea {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface ScannedImage {
	id: string;
	url: string;
	blob: Blob;
	name: string;
	filter: ImageFilter;
	rotation: number; // 0, 90, 180, 270
	signature?: string; // base64 signature image
}

export enum AppState {
	IDLE = "IDLE",
	SCANNING = "SCANNING",
	PREVIEW = "PREVIEW",
	EDITING = "EDITING",
}
