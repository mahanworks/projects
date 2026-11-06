import { Router } from "express";
import { prisma } from "../db";
import { requireUser } from "../middleware";
const router = Router();
router.use(requireUser);
router.get("/", async (req, res) => res.json(await prisma.sender.findMany({ where: { userId: (req as any).user.id } })));
router.post("/", async (req, res) => {
  const email = String(req.body.email || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Valid sender email required." });
  const sender = await prisma.sender.upsert({
    where: { userId_email: { userId: (req as any).user.id, email } },
    update: {}, create: { userId: (req as any).user.id, email }
  });
  res.status(201).json(sender);
});
export default router;
