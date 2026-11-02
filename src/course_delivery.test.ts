import { strict as assert } from "node:assert";
import { deliveryStatus } from "./course_delivery.ts";

const now = new Date("2026-10-24T00:00:00.000Z");
const base = { courseId: "algebra-1", learnerId: "learner-7", educatorId: "teacher-2", deadline: "2026-10-23T00:00:00.000Z" };
assert.equal(deliveryStatus(base, now), "overdue");
assert.equal(deliveryStatus({ ...base, completedAt: "2026-10-22T12:00:00.000Z" }, now), "completed");
console.log("course delivery decision: overdue and completed are distinguished");
