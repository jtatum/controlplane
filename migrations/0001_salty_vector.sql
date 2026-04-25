DROP INDEX "idx_email_messages_agent_visible";--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "instance_type" SET DEFAULT 't4g.medium';--> statement-breakpoint
CREATE INDEX "idx_agents_owner_status" ON "agents" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "idx_email_messages_agent_review_created" ON "email_messages" USING btree ("agent_id","review_status","created_at");--> statement-breakpoint
CREATE INDEX "idx_email_messages_agent_visible" ON "email_messages" USING btree ("agent_id","direction","visible_to_agent");