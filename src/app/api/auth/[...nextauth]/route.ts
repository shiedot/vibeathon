import { handlers } from "@/auth";

export const { GET, POST } = handlers;

// Auth.js hits the DB through node-postgres, which needs the Node runtime.
export const runtime = "nodejs";
