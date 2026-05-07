export interface EmailSummary {
  id: string;
  from: string;
  subject: string;
  date: string;
  intro?: string;
}

export interface EmailDetail extends EmailSummary {
  body: string;
  textBody: string;
  htmlBody: string;
}

export interface MailboxState {
  address: string;
  token: string;
}