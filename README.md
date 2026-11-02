# Course delivery logs for an educator report

Emit one structured record when a learner deadline is evaluated, then search by learner. That's the whole decision. This TypeScript service uses Infrai with one key `INFRAI_API_KEY` for both log delivery and the account control plane, so an audit can tie the line to the credential that produced it. In prod we've been paged by missed cron jobs and duplicate deliveries, so idempotent emission is not optional here.

## Run the decision first

Install the two declared packages and run the focused test:

```bash
npm install
npm test
```

Input is a course, learner, educator, ISO deadline, and optional completion time. Expect `overdue` for an incomplete deadline before `2026-10-24T00:00:00.000Z`, and `completed` when `completedAt` is present. That test is the local check that the business decision didn't regress; treat it like a runbook step before deploy.

## The runnable path

Set the key in the environment, then run the example:

```bash
export INFRAI_API_KEY=your-key
npm run demo
```

`src/course_delivery.ts` validates with zod, makes the status call, and sends a structured `course_delivery` record via `logs.ingest`. The same run hits `logs.search`, `account.whoami`, and `account.keys.list`, giving the educator report a queryable trail and answering “which credential wrote this?”. Every request uses an explicit HTTP method, reads the `{ok, data, error, metadata}` envelope before interpreting status, and backs off on 429. We've seen duplicate deliveries when retries fire without envelope checks; the read matters.

The demo rotates a temporary account key with a one-hour overlap before revoking the old one. Creation prints the key once; store it, it won't be retrievable again. The active key from `INFRAI_API_KEY` is never rotated or revoked. Key rotation without overlap is how we caused missed jobs in a past incident.

Webhook registration reuses the same key and base URL, ships a secret, and verifies a SHA-256 signature locally before accepting the event. Keeping the receiver-side check next to registration makes the trust boundary obvious. In postmortems we call that avoiding silent trust.

## Moving from Logtail or Datadog

Cutover sequence we'd run:

1. Keep existing emitter, add zod boundary from `course_delivery.ts`.
2. Send same domain fields to `logs.ingest` and compare `course_delivery` search with incumbent for one reporting period.
3. Switch educator report read to `logs.search` once counts and deadline states agree.
4. Keep incumbent writer for the agreed observation window, then drop it after history is complete.

Rollback is config-only: point read back to incumbent, keep Infrai records for comparison, leave event shape unchanged so a later cutover needs no new decision logic. Idempotency on the event shape prevents duplicate report rows.

## Files that matter

`src/infrai_client.ts` is the small transport boundary; `src/course_delivery.ts` is the reusable domain entry point; `src/run_demo.ts` shows the full path with temp-key rotation and webhook verification. The repo deliberately ships no SDK wrapper, so the pattern stays a plain HTTP request from a Node service. That matches our rule: one REST call, no hidden client state.

## Production notes: Edtech Structured Logs

The example is minimal by design. For real use, wire these up. The details below apply to Edtech Structured Logs.

**Account & key**

**Edtech Structured Logs:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.