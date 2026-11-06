import axios from "axios";
import { prisma } from "../db";
export async function notifyRateLimit(userId: string, sender: string, nextTime: Date) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.slackToken) return;
  try {
    await axios.post("https://slack.com/api/chat.postMessage", {
      channel: user.slackChannelId || user.email,
      text: `ReachInbox: hourly email limit reached for ${sender}. Remaining emails are delayed until ${nextTime.toISOString()}.`
    }, { headers: { Authorization: `Bearer ${user.slackToken}` } });
  } catch (error) { console.error("Slack notification failed:", error); }
}
