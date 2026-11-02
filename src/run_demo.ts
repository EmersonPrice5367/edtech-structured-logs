import { createHmac, timingSafeEqual } from "node:crypto";
import { account, logs } from "./infrai_client.ts";
import { reportDelivery } from "./course_delivery.ts";

function verifyWebhook(body: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

const delivery = { courseId: process.env.COURSE_ID ?? "algebra-1", learnerId: process.env.LEARNER_ID ?? "learner-7", educatorId: process.env.EDUCATOR_ID ?? "teacher-2", deadline: process.env.DEADLINE ?? "2026-12-01T17:00:00.000Z" };
const status = await reportDelivery(delivery);
const found = await logs.search({ q: "course_delivery", filter: delivery.learnerId });
const identity = await account.whoami();
const keys = await account.keysList();
console.log(JSON.stringify({ status, found, identity, keys }, null, 2));

const temporary = await account.keysCreate({ name: "rotation-check", scopes: ["logs.search"], idempotency_key: `rotation-${Date.now()}` }) as { id?: string; key?: string };
if (temporary.key) console.log("Save the returned key now; it is shown only once.");
if (temporary.id) {
  await account.keysRotate(temporary.id, { grace_hours: 1, idempotency_key: `rotate-${temporary.id}` });
  await account.keysRevoke(temporary.id);
}

const webhookSecret = process.env.WEBHOOK_SECRET ?? "demo-secret";
const webhookBody = JSON.stringify({ event: "error.captured" });
const signature = createHmac("sha256", webhookSecret).update(webhookBody).digest("hex");
await account.webhooksRegister({ url: process.env.WEBHOOK_URL ?? "https://example.edu/infrai-events", events: ["error.captured"], secret: webhookSecret });
console.log(`webhook signature verified: ${verifyWebhook(webhookBody, signature, webhookSecret)}`);
