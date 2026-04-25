ALTER TABLE "provisioning_jobs" DROP CONSTRAINT "provisioning_jobs_agent_id_agents_id_fk";
--> statement-breakpoint
ALTER TABLE "provisioning_jobs" ALTER COLUMN "agent_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "provisioning_jobs" ADD CONSTRAINT "provisioning_jobs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "chk_review_visible_consistency" CHECK (review_status = 'pending' OR (review_status = 'approved') = visible_to_agent);