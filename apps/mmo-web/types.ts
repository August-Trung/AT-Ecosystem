export interface ToolRoute {
	id: string;
	path: string;
	name: string;
	icon: any;
	description: string;
	color: string;
}

export interface Bank {
	id: number;
	name: string;
	code: string;
	bin: string;
	shortName: string;
	logo: string;
	transferSupported: number;
	lookupSupported: number;
}

export interface Attachment {
	id: string;
	filename: string;
	contentType: string;
	disposition: string;
	transferEncoding: string;
	related: boolean;
	size: number;
	downloadUrl: string;
}

export interface EmailSummary {
	id: string;
	from: string;
	subject: string;
	date: string;
	intro?: string;
	seen: boolean;
	hasAttachments: boolean;
}

export interface EmailDetail extends EmailSummary {
	body: string;
	textBody: string;
	htmlBody: string;
	attachments: Attachment[];
}

export interface MailboxState {
	address: string;
	token: string;
}

export interface DomainWhoisInfo {
	domainName: string;
	registrar: string;
	creationDate: string;
	expirationDate: string;
	updatedDate: string;
	nameServers: string[];
	status: string[];
	dnssec: string;
	registrant: {
		name: string;
		organization: string;
		email: string;
		country: string;
	};
	raw: any;
}

export interface WhoisData {
	ip?: string;
	city?: string;
	region?: string;
	country?: string;
	org?: string;
	asn?: string;
	lat?: number;
	lon?: number;
	source?: string;
	raw?: any;
}

export interface Note {
	id: string;
	title: string;
	content: string;
	isCode: boolean;
	updatedAt: number;
}

export interface ShortenedLink {
	id: string;
	original: string;
	short: string;
	provider: string;
	createdAt: number;
}
