"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ticketService } from "@/lib/runtime";
import type { Category } from "@/lib/domain";
export type FormState = { message: string; ok?: boolean };
export async function submitTicket(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const result = await ticketService().submitTicket({
    submissionId: form.get("submissionId"),
    subject: form.get("subject"),
    description: form.get("description"),
  });
  if (!result.ok) return { message: result.message };
  revalidatePath("/", "layout");
  redirect(`/customer/tickets/${result.data.id}`);
}
export async function updateTicket(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const input = {
    id: String(form.get("id")),
    expectedVersion: Number(form.get("version")),
  };
  const action = form.get("action");
  const service = ticketService();
  const result =
    action === "route"
      ? service.routeTicket({
          ...input,
          category: String(form.get("category")) as Category,
        })
      : action === "spam"
        ? service.markSpam(input)
        : action === "restore"
          ? service.restoreTicket(input)
          : { ok: false as const, message: "Unknown action." };
  if (!result.ok) return { message: result.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Decision saved." };
}
