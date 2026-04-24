CREATE TYPE "public"."agent_environment" AS ENUM('dev', 'prod');--> statement-breakpoint
CREATE TYPE "public"."agent_status" AS ENUM('requested', 'provisioning', 'running', 'updating', 'stopping', 'stopped', 'terminated', 'error');--> statement-breakpoint
CREATE TYPE "public"."channel_type" AS ENUM('telegram', 'email', 'slack', 'discord');--> statement-breakpoint
CREATE TYPE "public"."email_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."provisioning_job_status" AS ENUM('pending', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."provisioning_job_type" AS ENUM('provision', 'terminate', 'upgrade', 'deploy_skills', 'patch_os', 'fleet_rollout');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TABLE "agent_skills" (
	"agent_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"deployed_hash" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deployed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_skills_agent_id_skill_id_pk" PRIMARY KEY("agent_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"agent_name" text NOT NULL,
	"environment" "agent_environment" DEFAULT 'dev' NOT NULL,
	"status" "agent_status" DEFAULT 'requested' NOT NULL,
	"version_id" uuid,
	"ec2_instance_id" text,
	"private_ip" "inet",
	"availability_zone" text,
	"instance_type" text DEFAULT 'c7g.large' NOT NULL,
	"bedrock_region" text NOT NULL,
	"agent_token_hash" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provisioned_at" timestamp with time zone,
	"terminated_at" timestamp with time zone,
	CONSTRAINT "agents_agent_name_unique" UNIQUE("agent_name")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_type" text DEFAULT 'user' NOT NULL,
	"agent_id" uuid,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_email" (
	"channel_id" uuid PRIMARY KEY NOT NULL,
	"mailbox_address" text NOT NULL,
	"inbound_review" boolean DEFAULT true NOT NULL,
	"outbound_review" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_email_mailbox_address_unique" UNIQUE("mailbox_address")
);
--> statement-breakpoint
CREATE TABLE "channel_telegram" (
	"channel_id" uuid PRIMARY KEY NOT NULL,
	"bot_token_enc" text NOT NULL,
	"bot_username" text,
	"webhook_secret" text NOT NULL,
	"webhook_active" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"type" "channel_type" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"s3_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"direction" "email_direction" NOT NULL,
	"sender" text NOT NULL,
	"recipients" text[] NOT NULL,
	"cc" text[] DEFAULT '{}' NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"body_text" text,
	"body_html" text,
	"ses_message_id" text,
	"review_status" "review_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"visible_to_agent" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "openclaw_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"ami_id" text,
	"release_notes" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"released_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "openclaw_versions_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "provisioning_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"type" "provisioning_job_type" NOT NULL,
	"status" "provisioning_job_status" DEFAULT 'pending' NOT NULL,
	"initiated_by" uuid NOT NULL,
	"temporal_workflow_id" text,
	"temporal_run_id" text,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"current_hash" text NOT NULL,
	"config_schema" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skills_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_external_id_unique" UNIQUE("external_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_version_id_openclaw_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."openclaw_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_email" ADD CONSTRAINT "channel_email_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_telegram" ADD CONSTRAINT "channel_telegram_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_message_id_email_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."email_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provisioning_jobs" ADD CONSTRAINT "provisioning_jobs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provisioning_jobs" ADD CONSTRAINT "provisioning_jobs_initiated_by_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agents_owner_id" ON "agents" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_agents_status" ON "agents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_agents_environment" ON "agents" USING btree ("environment");--> statement-breakpoint
CREATE INDEX "idx_audit_log_agent_id" ON "audit_log" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_log_actor_id" ON "audit_log" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_log_action" ON "audit_log" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_log_created_at" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_channels_agent_type" ON "channels" USING btree ("agent_id","type");--> statement-breakpoint
CREATE INDEX "idx_channels_agent_id" ON "channels" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_email_attachments_message_id" ON "email_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_email_messages_agent_id" ON "email_messages" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_email_messages_review" ON "email_messages" USING btree ("review_status");--> statement-breakpoint
CREATE INDEX "idx_email_messages_agent_visible" ON "email_messages" USING btree ("agent_id","visible_to_agent","direction");--> statement-breakpoint
CREATE INDEX "idx_email_messages_created_at" ON "email_messages" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_openclaw_versions_default" ON "openclaw_versions" USING btree ("is_default") WHERE is_default = true;--> statement-breakpoint
CREATE INDEX "idx_provisioning_jobs_agent_id" ON "provisioning_jobs" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_provisioning_jobs_status" ON "provisioning_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_provisioning_jobs_temporal" ON "provisioning_jobs" USING btree ("temporal_workflow_id");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");