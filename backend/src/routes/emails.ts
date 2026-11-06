import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireUser } from "../middleware";
import { enqueueEmail } from "../queue";
import { indexEmail, searchEmails } from "../services/search";
const router = Router();
router.use(requireUser);
const schema = z.object({
  subject: z.string().min(1).max(250),
  body: z.string().min(1),
  startAt: z.string().datetime(),
  delayBetweenMs: z.number().int().min(500).max(3600000).optional(),
  hourlyLimit: z.number().int().min(1).max(10000).optional(),
  senderEmail: z.string().email(),
  recipients: z.array(z.string().email()).min(1).max(5000)
});
router.post("/schedule", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;
  const start = new Date(data.startAt);
  if (start.getTime() < Date.now() - 60_000) return res.status(400).json({ error: "Start time must be in the future." });
  const user = (req as any).user;
  const sender = await prisma.sender.upsert({
    where: { userId_email: { userId: user.id, email: data.senderEmail } },
    update: { hourlyLimit: data.hourlyLimit || undefined }, create: { userId: user.id, email: data.senderEmail, hourlyLimit: data.hourlyLimit || undefined }
  });
  const created = [];
  for (let i = 0; i < data.recipients.length; i++) {
    const scheduledAt = new Date(start.getTime() + i * (data.delayBetweenMs || 2000));
    const email = await prisma.email.create({ data: {
      recipient: data.recipients[i], subject: data.subject, body: data.body,
      scheduledAt, senderEmail: data.senderEmail, userId: user.id, senderId: sender.id
    }});
    await enqueueEmail(email.id, scheduledAt);
    await indexEmail(email);
    created.push(email);
  }
  res.status(201).json({ count: created.length, emails: created });
});
router.get("/", async (req, res) => {
  const user = (req as any).user;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const indexed = await searchEmails(user.id, status, q);
  if (indexed) return res.json(indexed);
  const emails = await prisma.email.findMany({
    where: { userId: user.id, ...(status ? { status } : {}),
      ...(q ? { OR: [{ recipient: { contains: q, mode: "insensitive" } }, { subject: { contains: q, mode: "insensitive" } }] } : {}) },
    orderBy: { scheduledAt: "desc" }, take: 250
  });
  res.json(emails);
});
export default router;
