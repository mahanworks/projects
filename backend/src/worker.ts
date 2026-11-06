import { Worker, Job, DelayedError } from "bullmq";
import { connection } from "./redis";
import { prisma } from "./db";
import { config } from "./config";
import { sendTestEmail } from "./services/mail";
import { indexEmail } from "./services/search";
import { notifyRateLimit } from "./services/slack";

// Atomic per-sender rate reservation. Returns [allowed, waitMs].
// Counts are shared by every worker using this Redis instance.
const reserveScript = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
local last = tonumber(redis.call('GET', KEYS[2]) or '0')
local now = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local gap = tonumber(ARGV[3])
local hourEnd = tonumber(ARGV[4])
if count >= limit then return {0, math.max(1000, hourEnd-now)} end
local allowedAt = last + gap
if allowedAt > now then return {0, allowedAt-now} end
redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], 7200)
redis.call('SET', KEYS[2], now, 'EX', 7200)
return {1, 0}
`;
async function reserveSendSlot(sender: string, perHour: number, minDelay: number) {
  const now = Date.now();
  const hourStart = Math.floor(now / 3600000) * 3600000;
  const hourEnd = hourStart + 3600000;
  const keys = [`rate:${sender}:${hourStart}`, `last-send:${sender}`];
  const result = await connection.eval(reserveScript, 2, ...keys, now, perHour, minDelay, hourEnd) as number[];
  return { allowed: result[0] === 1, waitMs: Number(result[1]), hourEnd };
}
async function processJob(job: Job<{ emailId: string }>, token?: string) {
  const email = await prisma.email.findUnique({ where: { id: job.data.emailId }, include: { user: true, sender: true } });
  if (!email || email.status === "sent" || email.status === "failed") return;
  const sender = email.senderEmail;
  const reservation = await reserveSendSlot(sender, email.sender?.hourlyLimit || config.hourlyLimit, config.minDelayMs);
  if (!reservation.allowed) {
    const nextTime = new Date(Date.now() + reservation.waitMs);
    if (reservation.waitMs >= 30000) {
      await notifyRateLimit(email.userId, sender, new Date(reservation.hourEnd));
    }
    if (!token) throw new Error("BullMQ job token unavailable for delay");
    await job.moveToDelayed(Date.now() + reservation.waitMs, token);
    throw new DelayedError();
  }
  // DB status check makes retries/replayed jobs skip already completed messages.
  await prisma.email.update({ where: { id: email.id }, data: { status: "sending", error: null } });
  try {
    await sendTestEmail(email.recipient, email.subject, email.body);
    const updated = await prisma.email.update({ where: { id: email.id }, data: { status: "sent", sentAt: new Date() } });
    await indexEmail(updated);
  } catch (error: any) {
    const updated = await prisma.email.update({ where: { id: email.id }, data: { status: "failed", error: String(error?.message || error) } });
    await indexEmail(updated);
    throw error;
  }
}
const worker = new Worker("scheduled-emails", processJob, {
  connection, concurrency: config.concurrency
});
worker.on("completed", job => console.log(`Email job completed: ${job.id}`));
worker.on("failed", (job, err) => console.error(`Email job failed: ${job?.id}`, err.message));
console.log(`Email worker started (concurrency=${config.concurrency}, minDelay=${config.minDelayMs}ms, hourlyLimit=${config.hourlyLimit})`);
process.on("SIGINT", async () => { await worker.close(); await prisma.$disconnect(); process.exit(0); });
