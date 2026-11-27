import { z } from "zod";
import { categories, labels } from "./catalog";
export const unit = z.number().finite().min(0).max(1);
export const versionSchema = z.number().int().positive();
export const submissionSchema = z.object({
  submissionId: z.uuid(),
  subject: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(5000),
});
export const mutationSchema = z.object({
  id: z.uuid(),
  expectedVersion: versionSchema,
});
export const routeSchema = mutationSchema.extend({
  category: z.enum(categories),
});
export const settingsSchema = z
  .object({
    minConfidence: unit,
    minMargin: unit,
    categoryOverrides: z
      .object({
        technical: unit.optional(),
        complaint: unit.optional(),
        offer: unit.optional(),
        spam: unit.optional(),
      })
      .strict(),
  })
  .strict();
export const analysisSchema = z
  .object({
    choice: z.enum(labels),
    confidence: unit,
    probabilities: z.record(z.enum(labels), unit),
    model: z.string().min(1),
    questionVersion: z.string().min(1),
  })
  .superRefine((a, ctx) => {
    const values = Object.values(a.probabilities);
    if (
      Math.abs(values.reduce((s, p) => s + p, 0) - 1) > 0.010000001 ||
      a.probabilities[a.choice] < Math.max(...values)
    )
      ctx.addIssue({
        code: "custom",
        message: "Inconsistent category distribution",
      });
  });
