import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();
export const config = {
  port: Number(process.env.PORT || 4000),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  sessionSecret: process.env.SESSION_SECRET || "development-only-change-me",
  redisHost: process.env.REDIS_HOST || "127.0.0.1",
  redisPort: Number(process.env.REDIS_PORT || 6379),
  elasticUrl: process.env.ELASTICSEARCH_URL || "",
  etherealUser: process.env.ETHEREAL_USER || "",
  etherealPass: process.env.ETHEREAL_PASS || "",
  concurrency: Number(process.env.WORKER_CONCURRENCY || 5),
  minDelayMs: Number(process.env.MIN_DELAY_MS || 2000),
  hourlyLimit: Number(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || 200),
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  slackClientId: process.env.SLACK_CLIENT_ID || "",
  slackClientSecret: process.env.SLACK_CLIENT_SECRET || ""
};
