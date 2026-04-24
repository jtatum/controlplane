import { z } from "zod";
import type { ChannelType } from "./enums.js";

export const SetupTelegramSchema = z.object({
  botToken: z.string().regex(/^\d+:[A-Za-z0-9_-]{35}$/),
});
export type SetupTelegramInput = z.infer<typeof SetupTelegramSchema>;

export interface ChannelSummary {
  id: string;
  agentId: string;
  type: ChannelType;
  enabled: boolean;
  createdAt: string;
}

export interface TelegramChannelDetail extends ChannelSummary {
  type: "telegram";
  botUsername: string | null;
  webhookActive: boolean;
  groups: Array<{
    chatId: number;
    title: string;
    allowlist: string[];
  }>;
}

export interface EmailChannelDetail extends ChannelSummary {
  type: "email";
  mailboxAddress: string;
  inboundReview: boolean;
  outboundReview: boolean;
}
