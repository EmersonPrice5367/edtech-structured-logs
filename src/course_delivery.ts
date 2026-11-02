import { z } from "zod";
import { logs } from "./infrai_client.ts";

export const deliveryRequest = z.object({
  courseId: z.string().min(1), learnerId: z.string().min(1), deadline: z.string().datetime(),
  completedAt: z.string().datetime().optional(), educatorId: z.string().min(1)
});
export type DeliveryRequest = z.infer<typeof deliveryRequest>;

export function deliveryStatus(input: DeliveryRequest, now: Date): "completed" | "overdue" | "due" {
  const request = deliveryRequest.parse(input);
  if (request.completedAt) return "completed";
  return new Date(request.deadline).getTime() < now.getTime() ? "overdue" : "due";
}

export async function reportDelivery(raw: unknown, now = new Date()): Promise<string> {
  const request = deliveryRequest.parse(raw);
  const status = deliveryStatus(request, now);
  await logs.ingest({ entries: [{ message: "course_delivery", level: "info", context: { ...request, status } }] });
  return status;
}
