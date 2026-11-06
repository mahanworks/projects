import { Queue } from "bullmq";
import { connection } from "./redis";
export const EMAIL_QUEUE = "scheduled-emails";
export const emailQueue = new Queue(EMAIL_QUEUE, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: { age: 86400, count: 5000 },
    removeOnFail: false
  }
});
export async function enqueueEmail(emailId: string, scheduledAt: Date) {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  await emailQueue.add("send-email", { emailId }, {
    jobId: `email-${emailId}`,
    delay
  });
}
