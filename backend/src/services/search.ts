import { Client } from "@elastic/elasticsearch";
import { config } from "../config";
let client: Client | null = config.elasticUrl ? new Client({ node: config.elasticUrl }) : null;
export async function indexEmail(email: any) {
  if (!client) return;
  try {
    await client.index({ index: "reachinbox-emails", id: email.id, document: {
      id: email.id, recipient: email.recipient, subject: email.subject,
      body: email.body, status: email.status, senderEmail: email.senderEmail,
      scheduledAt: email.scheduledAt, sentAt: email.sentAt, userId: email.userId
    }, refresh: true });
  } catch (e) { console.error("Elasticsearch indexing failed:", e); }
}
export async function searchEmails(userId: string, status: string | undefined, q: string) {
  if (!client) return null;
  try {
    const filters: any[] = [{ term: { userId } }];
    if (status) filters.push({ term: { status } });
    const result = await client.search({
      index: "reachinbox-emails",
      query: { bool: { filter: filters, must: q ? [{ multi_match: { query: q, fields: ["recipient", "subject", "body"] } }] : [{ match_all: {} }] } },
      sort: [{ scheduledAt: "desc" }], size: 250
    });
    return result.hits.hits.map((h: any) => h._source);
  } catch (e) { console.error("Elasticsearch search failed; falling back to DB:", e); return null; }
}
