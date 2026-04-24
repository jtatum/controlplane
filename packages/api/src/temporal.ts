import { Connection, Client } from "@temporalio/client";

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE ?? "default";

export const TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE ?? "controlplane";

let client: Client | null = null;

export async function getTemporalClient(): Promise<Client> {
  if (client) return client;
  const connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
  client = new Client({ connection, namespace: TEMPORAL_NAMESPACE });
  return client;
}
