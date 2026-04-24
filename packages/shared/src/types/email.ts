import { z } from "zod";
import type { EmailDirection, ReviewStatus } from "./enums.js";

export const SendEmailSchema = z.object({
  recipients: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).default([]),
  subject: z.string().max(500),
  bodyText: z.string(),
  bodyHtml: z.string().optional(),
});
export type SendEmailInput = z.infer<typeof SendEmailSchema>;

export const ReviewEmailSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  note: z.string().max(1000).optional(),
});
export type ReviewEmailInput = z.infer<typeof ReviewEmailSchema>;

export interface EmailMessage {
  id: string;
  agentId: string;
  direction: EmailDirection;
  sender: string;
  recipients: string[];
  cc: string[];
  subject: string;
  bodyText: string | null;
  bodyHtml: string | null;
  reviewStatus: ReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  visibleToAgent: boolean;
  sentAt: string | null;
  createdAt: string;
}

export interface EmailAttachment {
  id: string;
  messageId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  downloadUrl: string;
}

export interface AgentEmailMessage {
  id: string;
  direction: EmailDirection;
  sender: string;
  recipients: string[];
  cc: string[];
  subject: string;
  bodyText: string | null;
  bodyHtml: string | null;
  attachments: EmailAttachment[];
  receivedAt: string;
}
