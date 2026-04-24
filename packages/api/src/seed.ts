import { eq, sql } from "drizzle-orm";
import { db } from "./db.js";
import {
  users,
  agents,
  channels,
  channelEmail,
  emailMessages,
  openclawVersions,
  skills,
  agentSkills,
} from "@controlplane/shared";

async function seed() {
  console.log("Seeding database...");

  // Users
  const [devUser] = await db
    .insert(users)
    .values({
      externalId: "dev-user-001",
      email: "dev@openclaw.local",
      displayName: "Dev User",
      role: "admin",
    })
    .onConflictDoNothing({ target: users.externalId })
    .returning();

  const [alice] = await db
    .insert(users)
    .values({
      externalId: "dev-user-002",
      email: "alice@openclaw.local",
      displayName: "Alice Engineer",
      role: "user",
    })
    .onConflictDoNothing({ target: users.externalId })
    .returning();

  const ownerId =
    devUser?.id ??
    (
      await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.externalId, "dev-user-001"))
        .limit(1)
    )[0].id;

  const aliceId =
    alice?.id ??
    (
      await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.externalId, "dev-user-002"))
        .limit(1)
    )[0].id;

  console.log(`  Users: dev=${ownerId}, alice=${aliceId}`);

  // OpenClaw versions
  const [version] = await db
    .insert(openclawVersions)
    .values({
      version: "1.0.0",
      amiId: "ami-dev-00000001",
      releaseNotes: "Initial development release",
      isDefault: true,
    })
    .onConflictDoNothing({ target: openclawVersions.version })
    .returning();

  const versionId =
    version?.id ??
    (
      await db
        .select({ id: openclawVersions.id })
        .from(openclawVersions)
        .where(eq(openclawVersions.version, "1.0.0"))
        .limit(1)
    )[0].id;

  console.log(`  Version: ${versionId}`);

  // Agents
  const agentRows = [
    {
      ownerId,
      name: "Customer Support Bot",
      agentName: "support-bot-dev",
      environment: "dev" as const,
      status: "running" as const,
      versionId,
      bedrockRegion: "us-east-1",
      config: { systemPrompt: "You are a helpful customer support agent." },
    },
    {
      ownerId,
      name: "Internal Wiki Assistant",
      agentName: "wiki-assist-dev",
      environment: "dev" as const,
      status: "stopped" as const,
      versionId,
      bedrockRegion: "us-east-1",
      config: { systemPrompt: "You help employees search the internal wiki." },
    },
    {
      ownerId: aliceId,
      name: "Content Reviewer",
      agentName: "content-review-dev",
      environment: "dev" as const,
      status: "provisioning" as const,
      versionId,
      bedrockRegion: "us-west-2",
      config: {},
    },
  ];

  const insertedAgents = [];
  for (const row of agentRows) {
    const [agent] = await db
      .insert(agents)
      .values(row)
      .onConflictDoNothing({ target: agents.agentName })
      .returning();

    const id =
      agent?.id ??
      (
        await db
          .select({ id: agents.id })
          .from(agents)
          .where(eq(agents.agentName, row.agentName))
          .limit(1)
      )[0].id;

    insertedAgents.push(id);
  }

  const [supportBotId, wikiAssistId] = insertedAgents;
  console.log(`  Agents: ${insertedAgents.join(", ")}`);

  // Channels — email for support bot
  const existingChannel = await db
    .select()
    .from(channels)
    .where(
      sql`${channels.agentId} = ${supportBotId} AND ${channels.type} = 'email'`,
    )
    .limit(1);

  let emailChannelId: string;
  if (existingChannel.length > 0) {
    emailChannelId = existingChannel[0].id;
  } else {
    const [ch] = await db
      .insert(channels)
      .values({ agentId: supportBotId, type: "email", enabled: true })
      .returning();
    emailChannelId = ch.id;

    await db.insert(channelEmail).values({
      channelId: emailChannelId,
      mailboxAddress: "support@agents.openclaw.local",
      inboundReview: false,
      outboundReview: true,
    });
  }

  console.log(`  Email channel: ${emailChannelId}`);

  // Email messages — some pending review, some approved
  const emailRows = [
    {
      agentId: supportBotId,
      direction: "inbound" as const,
      sender: "customer@example.com",
      recipients: ["support@agents.openclaw.local"],
      subject: "Help with my order #12345",
      bodyText:
        "Hi, I placed an order last week and haven't received a shipping confirmation. Can you check on it?",
      reviewStatus: "approved" as const,
      reviewedBy: ownerId,
      visibleToAgent: true,
    },
    {
      agentId: supportBotId,
      direction: "outbound" as const,
      sender: "support@agents.openclaw.local",
      recipients: ["customer@example.com"],
      subject: "Re: Help with my order #12345",
      bodyText:
        "I found your order — it shipped yesterday and should arrive by Friday. Your tracking number is TRACK-98765.",
      reviewStatus: "pending" as const,
      visibleToAgent: false,
    },
    {
      agentId: supportBotId,
      direction: "inbound" as const,
      sender: "vip@example.com",
      recipients: ["support@agents.openclaw.local"],
      subject: "Partnership inquiry",
      bodyText:
        "We'd like to discuss a potential partnership with your team. Who should I contact?",
      reviewStatus: "pending" as const,
      visibleToAgent: false,
    },
    {
      agentId: supportBotId,
      direction: "outbound" as const,
      sender: "support@agents.openclaw.local",
      recipients: ["returns@example.com"],
      subject: "Return authorization for order #11111",
      bodyText: "I've authorized the return. Please ship the item back within 14 days.",
      reviewStatus: "rejected" as const,
      reviewedBy: ownerId,
      reviewNote: "Agent should not authorize returns without manager approval",
      visibleToAgent: false,
    },
  ];

  for (const row of emailRows) {
    await db.insert(emailMessages).values(row).onConflictDoNothing();
  }

  console.log(`  Email messages: ${emailRows.length}`);

  // Skills
  const skillRows = [
    {
      name: "web-search",
      displayName: "Web Search",
      description: "Search the web for current information",
      currentHash: "abc123",
    },
    {
      name: "code-interpreter",
      displayName: "Code Interpreter",
      description: "Execute Python code in a sandbox",
      currentHash: "def456",
    },
    {
      name: "document-qa",
      displayName: "Document Q&A",
      description: "Answer questions from uploaded documents",
      currentHash: "ghi789",
    },
  ];

  const insertedSkills = [];
  for (const row of skillRows) {
    const [skill] = await db
      .insert(skills)
      .values(row)
      .onConflictDoNothing({ target: skills.name })
      .returning();

    const id =
      skill?.id ??
      (
        await db
          .select({ id: skills.id })
          .from(skills)
          .where(eq(skills.name, row.name))
          .limit(1)
      )[0].id;

    insertedSkills.push(id);
  }

  console.log(`  Skills: ${insertedSkills.join(", ")}`);

  // Assign skills to support bot
  for (const skillId of insertedSkills.slice(0, 2)) {
    await db
      .insert(agentSkills)
      .values({ agentId: supportBotId, skillId, enabled: true })
      .onConflictDoNothing();
  }

  console.log("Seed complete.");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
