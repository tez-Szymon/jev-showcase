import "server-only";
import type { Analysis, Category, Result } from "./domain";
import { Conflict, Missing, Repository } from "./repository";
import {
  analysisSchema,
  mutationSchema,
  routeSchema,
  submissionSchema,
} from "./validation";
import { decideRouting } from "./jev/policy";
export function failure(error: unknown): Result<never> {
  if (error instanceof Conflict)
    return {
      ok: false,
      code: "conflict",
      message:
        "The data has changed or this action is unavailable. Refresh and try again.",
    };
  if (error instanceof Missing)
    return {
      ok: false,
      code: "not_found",
      message: "Request not found.",
    };
  return {
    ok: false,
    code: "storage",
    message: "Could not save your changes. Please try again.",
  };
}
const invalid = (): Result<never> => ({
  ok: false,
  code: "validation",
  message: "Check the form fields and try again.",
});
export function createTicketService(
  repo: Repository,
  enabled: boolean,
  classify: (input: {
    subject: string;
    description: string;
  }) => Promise<Analysis>,
) {
  return {
    async submitTicket(input: unknown): Promise<Result<{ id: string }>> {
      const parsed = submissionSchema.safeParse(input);
      if (!parsed.success) return invalid();
      let created: ReturnType<Repository["create"]>;
      try {
        created = repo.create(parsed.data, enabled);
      } catch (e) {
        return failure(e);
      }
      const { ticket, attempt } = created;
      if (attempt) {
        let result: Analysis | null = null;
        let reason: "api_error" | "invalid_result" = "api_error";
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const raw = await Promise.race([
            classify(parsed.data),
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error("timeout")), 8000);
            }),
          ]);
          const valid = analysisSchema.safeParse(raw);
          if (valid.success) result = valid.data;
          else reason = "invalid_result";
        } catch (e) {
          if (e instanceof Error && e.message === "invalid_result")
            reason = "invalid_result";
        } finally {
          if (timer) clearTimeout(timer);
        }
        try {
          repo.finish(
            ticket,
            attempt.id,
            result,
            result
              ? decideRouting(result, attempt.settings)
              : { action: "review", reason },
            result ? undefined : reason,
          );
        } catch {
          /* Ticket is already durable and remains available for manual handling. */
        }
      }
      return { ok: true, data: { id: ticket.id } };
    },
    routeTicket(input: {
      id: string;
      expectedVersion: number;
      category: Category;
    }): Result<void> {
      const parsed = routeSchema.safeParse(input);
      if (!parsed.success) return invalid();
      try {
        repo.mutate(
          parsed.data.id,
          parsed.data.expectedVersion,
          "route",
          parsed.data.category,
        );
        return { ok: true, data: undefined };
      } catch (e) {
        return failure(e);
      }
    },
    markSpam(input: { id: string; expectedVersion: number }): Result<void> {
      return change(input, "spam");
    },
    restoreTicket(input: {
      id: string;
      expectedVersion: number;
    }): Result<void> {
      return change(input, "restore");
    },
  };
  function change(input: unknown, action: "spam" | "restore"): Result<void> {
    const parsed = mutationSchema.safeParse(input);
    if (!parsed.success) return invalid();
    try {
      repo.mutate(parsed.data.id, parsed.data.expectedVersion, action);
      return { ok: true, data: undefined };
    } catch (e) {
      return failure(e);
    }
  }
}
