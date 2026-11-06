import { Router } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import axios from "axios";
import { prisma } from "../db";
import { config } from "../config";
const router = Router();

if (config.googleClientId && config.googleClientSecret) {
  passport.use(new GoogleStrategy({
    clientID: config.googleClientId, clientSecret: config.googleClientSecret,
    callbackURL: "http://localhost:4000/auth/google/callback"
  }, async (_access, _refresh, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) return done(new Error("Google account did not provide an email"));
      const user = await prisma.user.upsert({
        where: { email },
        update: { googleId: profile.id, name: profile.displayName, avatar: profile.photos?.[0]?.value },
        create: { email, googleId: profile.id, name: profile.displayName, avatar: profile.photos?.[0]?.value }
      });
      done(null, { id: user.id, email: user.email, name: user.name, avatar: user.avatar });
    } catch (e) { done(e as Error); }
  }));
}
router.get("/google", (req, res, next) => {
  if (!config.googleClientId) return res.status(400).send("Configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env");
  passport.authenticate("google", { scope: ["profile", "email"], session: false })(req, res, next);
});
router.get("/google/callback", passport.authenticate("google", { session: false, failureRedirect: `${config.frontendUrl}/login?error=google` }), (req, res) => {
  (req.session as any).user = req.user;
  res.redirect(config.frontendUrl);
});
router.post("/demo", async (_req, res) => {
  const user = await prisma.user.upsert({
    where: { email: "demo@reachinbox.local" },
    update: {},
    create: { email: "demo@reachinbox.local", name: "Demo User", avatar: null }
  });
  // Demo login is explicitly separate from real Google OAuth.
  (_req.session as any).user = { id: user.id, email: user.email, name: user.name, avatar: user.avatar };
  res.json((_req.session as any).user);
});
router.post("/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));
router.get("/me", (req, res) => res.json((req.session as any).user || null));

router.get("/slack", (req, res) => {
  if (!config.slackClientId) return res.status(400).send("Configure SLACK_CLIENT_ID and SLACK_CLIENT_SECRET in .env");
  const state = Math.random().toString(36).slice(2);
  (req.session as any).slackState = state;
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", config.slackClientId);
  url.searchParams.set("scope", "chat:write,incoming-webhook");
  url.searchParams.set("redirect_uri", "http://localhost:4000/auth/slack/callback");
  url.searchParams.set("state", state);
  res.redirect(url.toString());
});
router.get("/slack/callback", async (req, res) => {
  const user = (req.session as any).user;
  if (!user || req.query.state !== (req.session as any).slackState) return res.status(400).send("Invalid Slack OAuth state or session.");
  try {
    const response = await axios.post("https://slack.com/api/oauth.v2.access", new URLSearchParams({
      client_id: config.slackClientId, client_secret: config.slackClientSecret,
      code: String(req.query.code || ""), redirect_uri: "http://localhost:4000/auth/slack/callback"
    }));
    if (!response.data.ok) throw new Error(response.data.error);
    await prisma.user.update({ where: { id: user.id }, data: {
      slackToken: response.data.access_token,
      slackChannelId: response.data.incoming_webhook?.channel_id || null
    }});
    res.redirect(config.frontendUrl);
  } catch (e) { console.error(e); res.status(500).send("Slack connection failed."); }
});
router.post("/slack/disconnect", async (req, res) => {
  const user = (req.session as any).user;
  if (!user) return res.sendStatus(401);
  await prisma.user.update({ where: { id: user.id }, data: { slackToken: null, slackChannelId: null } });
  res.json({ ok: true });
});
export default router;
