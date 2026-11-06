import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import passport from "passport";
import { ExpressAdapter } from "@bull-board/express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { emailQueue } from "./queue";
import { config } from "./config";
import authRoutes from "./routes/auth";
import emailRoutes from "./routes/emails";
import senderRoutes from "./routes/senders";
import { prisma } from "./db";
const app = express();
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(session({
  secret: config.sessionSecret, resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: false, maxAge: 7 * 86400000 }
}));
app.use(passport.initialize());
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", authRoutes);
app.use("/api/emails", emailRoutes);
app.use("/api/senders", senderRoutes);
const boardAdapter = new ExpressAdapter();
boardAdapter.setBasePath("/admin/queues");
createBullBoard({ queues: [new BullMQAdapter(emailQueue)], serverAdapter: boardAdapter });
app.use("/admin/queues", boardAdapter.getRouter());
app.listen(config.port, () => console.log(`API listening on http://localhost:${config.port}`));
process.on("SIGINT", async () => { await prisma.$disconnect(); process.exit(0); });
