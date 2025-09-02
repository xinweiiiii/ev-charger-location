import { createClient } from "redis";

let client: ReturnType<typeof createClient> | null = null;

export function getRedis() {
  if (!client) {
    client = createClient({
      url: `redis://default:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
    });
    client.on("error", (err) => console.error("Redis Client Error", err));
    client.connect().catch((e) => console.error("Redis connect error:", e));
  }
  return client;
}