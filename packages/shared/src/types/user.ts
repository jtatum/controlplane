import type { UserRole } from "./enums.js";

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
}

export interface UserWithAgentCount extends UserProfile {
  agentCount: number;
}
