"use client";
import { useActionState, useState } from "react";
import { submitTicket } from "@/app/actions/tickets";
export function TicketForm({
  submissionId,
  enabled,
}: {
  submissionId: string;
  enabled: boolean;
}) {
  const [stableSubmissionId] = useState(submissionId);
  const [state, action, pending] = useActionState(submitTicket, {
    message: "",
  });
  return (
    <form action={action} className="stack">
      <input type="hidden" name="submissionId" value={stableSubmissionId} />
      <label>
        Request subject
        <input
          name="subject"
          required
          minLength={3}
          maxLength={160}
          placeholder="E.g. My internet drops out every evening"
        />
      </label>
      <label>
        What can we help with?
        <textarea
          name="description"
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          placeholder="Describe the issue, when it started, and what you need help with."
        />
      </label>
      <p className="hint">
        10 to 5,000 characters. Do not include passwords or sensitive
        information.
      </p>
      <button disabled={pending} className="primary">
        {pending
          ? enabled
            ? "Saving and analyzing…"
            : "Saving…"
          : "Submit request ↗"}
      </button>
      {pending && enabled && (
        <p role="status">
          Jev is analyzing your request. This can take up to 8 seconds.
        </p>
      )}
      {state.message && (
        <p role="alert" className="notice error">
          {state.message}
        </p>
      )}
    </form>
  );
}
