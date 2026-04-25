import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  inet,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

// -- Enums --

export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);

export const agentStatusEnum = pgEnum("agent_status", [
  "requested",
  "provisioning",
  "running",
  "updating",
  "stopping",
  "stopped",
  "terminated",
  "error",
]);

export const agentEnvironmentEnum = pgEnum("agent_environment", [
  "dev",
  "prod",
]);

export const channelTypeEnum = pgEnum("channel_type", [
  "telegram",
  "email",
  "slack",
  "discord",
]);

export const emailDirectionEnum = pgEnum("email_direction", [
  "inbound",
  "outbound",
]);

export const reviewStatusEnum = pgEnum("review_status", [
  "pending",
  "approved",
  "rejected",
]);

export const provisioningJobStatusEnum = pgEnum("provisioning_job_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

export const provisioningJobTypeEnum = pgEnum("provisioning_job_type", [
  "provision",
  "terminate",
  "upgrade",
  "deploy_skills",
  "patch_os",
  "fleet_rollout",
]);

// -- Tables --

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalId: text("external_id").notNull().unique(),
    email: text("email").notNull().unique(),
    displayName: text("display_name").notNull(),
    role: userRoleEnum("role").notNull().default("user"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_users_email").on(table.email)],
);

export const openclawVersions = pgTable(
  "openclaw_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    version: text("version").notNull().unique(),
    amiId: text("ami_id"),
    releaseNotes: text("release_notes"),
    isDefault: boolean("is_default").notNull().default(false),
    releasedAt: timestamp("released_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_openclaw_versions_default")
      .on(table.isDefault)
      .where(sql`is_default = true`),
  ],
);

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    agentName: text("agent_name").notNull().unique(),
    environment: agentEnvironmentEnum("environment").notNull().default("dev"),
    status: agentStatusEnum("status").notNull().default("requested"),
    versionId: uuid("version_id").references(() => openclawVersions.id),
    ec2InstanceId: text("ec2_instance_id"),
    privateIp: inet("private_ip"),
    availabilityZone: text("availability_zone"),
    instanceType: text("instance_type").notNull().default("t4g.medium"),
    bedrockRegion: text("bedrock_region").notNull(),
    agentTokenHash: text("agent_token_hash"),
    config: jsonb("config").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    provisionedAt: timestamp("provisioned_at", { withTimezone: true }),
    terminatedAt: timestamp("terminated_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_agents_owner_id").on(table.ownerId),
    index("idx_agents_status").on(table.status),
    index("idx_agents_environment").on(table.environment),
  ],
);

export const channels = pgTable(
  "channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    type: channelTypeEnum("type").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_channels_agent_type").on(table.agentId, table.type),
    index("idx_channels_agent_id").on(table.agentId),
  ],
);

export const channelTelegram = pgTable("channel_telegram", {
  channelId: uuid("channel_id")
    .primaryKey()
    .references(() => channels.id, { onDelete: "cascade" }),
  botTokenEnc: text("bot_token_enc").notNull(),
  botUsername: text("bot_username"),
  webhookSecret: text("webhook_secret").notNull(),
  webhookActive: boolean("webhook_active").notNull().default(false),
  config: jsonb("config").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const channelEmail = pgTable("channel_email", {
  channelId: uuid("channel_id")
    .primaryKey()
    .references(() => channels.id, { onDelete: "cascade" }),
  mailboxAddress: text("mailbox_address").notNull().unique(),
  inboundReview: boolean("inbound_review").notNull().default(true),
  outboundReview: boolean("outbound_review").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const emailMessages = pgTable(
  "email_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    direction: emailDirectionEnum("direction").notNull(),
    sender: text("sender").notNull(),
    recipients: text("recipients").array().notNull(),
    cc: text("cc").array().notNull().default([]),
    subject: text("subject").notNull().default(""),
    bodyText: text("body_text"),
    bodyHtml: text("body_html"),
    sesMessageId: text("ses_message_id"),
    reviewStatus: reviewStatusEnum("review_status")
      .notNull()
      .default("pending"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    visibleToAgent: boolean("visible_to_agent").notNull().default(false),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_email_messages_agent_id").on(table.agentId),
    index("idx_email_messages_review").on(table.reviewStatus),
    index("idx_email_messages_agent_visible").on(
      table.agentId,
      table.visibleToAgent,
      table.direction,
    ),
    index("idx_email_messages_created_at").on(table.createdAt),
  ],
);

export const emailAttachments = pgTable(
  "email_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => emailMessages.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    s3Key: text("s3_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_email_attachments_message_id").on(table.messageId)],
);

export const skills = pgTable("skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  currentHash: text("current_hash").notNull(),
  configSchema: jsonb("config_schema"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const agentSkills = pgTable(
  "agent_skills",
  {
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    deployedHash: text("deployed_hash"),
    enabled: boolean("enabled").notNull().default(true),
    config: jsonb("config").notNull().default({}),
    deployedAt: timestamp("deployed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.agentId, table.skillId] })],
);

export const provisioningJobs = pgTable(
  "provisioning_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    type: provisioningJobTypeEnum("type").notNull(),
    status: provisioningJobStatusEnum("status").notNull().default("pending"),
    initiatedBy: uuid("initiated_by")
      .notNull()
      .references(() => users.id),
    temporalWorkflowId: text("temporal_workflow_id"),
    temporalRunId: text("temporal_run_id"),
    params: jsonb("params").notNull().default({}),
    result: jsonb("result"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_provisioning_jobs_agent_id").on(table.agentId),
    index("idx_provisioning_jobs_status").on(table.status),
    index("idx_provisioning_jobs_temporal").on(table.temporalWorkflowId),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id),
    actorType: text("actor_type").notNull().default("user"),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id"),
    detail: jsonb("detail").notNull().default({}),
    ipAddress: inet("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_audit_log_agent_id").on(table.agentId, table.createdAt),
    index("idx_audit_log_actor_id").on(table.actorId, table.createdAt),
    index("idx_audit_log_action").on(table.action, table.createdAt),
    index("idx_audit_log_created_at").on(table.createdAt),
  ],
);
