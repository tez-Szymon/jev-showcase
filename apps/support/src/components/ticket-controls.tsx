"use client";
import { useActionState } from "react";
import { updateTicket } from "@/app/actions/tickets";
import { categories, catalog } from "@/lib/catalog";
import type { Ticket } from "@/lib/domain";
export function TicketControls({ ticket }: { ticket: Ticket }) {
  const [state, action, pending] = useActionState(updateTicket, {
    message: "",
  });
  return (
    <form action={action} className="stack">
      <input name="id" type="hidden" value={ticket.id} />
      <input name="version" type="hidden" value={ticket.version} />
      {ticket.status !== "spam" ? (
        <>
          <label>
            Category and team
            <select
              name="category"
              defaultValue={ticket.category ?? "technical"}
            >
              {categories.map((k) => (
                <option key={k} value={k}>
                  {catalog[k].name} → {catalog[k].department}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary"
            name="action"
            value="route"
            disabled={pending}
          >
            {pending
              ? "Saving…"
              : ticket.status === "routed"
                ? "Change assignment"
                : "Assign to team"}
          </button>
          <button
            className="danger"
            name="action"
            value="spam"
            disabled={pending}
          >
            Move to spam
          </button>
        </>
      ) : (
        <button
          className="primary"
          name="action"
          value="restore"
          disabled={pending}
        >
          Restore to queue
        </button>
      )}
      {state.message && (
        <p role="status" className={`notice ${state.ok ? "" : "error"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
