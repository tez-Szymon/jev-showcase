import Link from "next/link";
import { notFound } from "next/navigation";
import { repository } from "@/lib/runtime";
import { env } from "@/lib/env";
import { statusNames } from "@/lib/catalog";
import { reasonNames } from "@/lib/jev/policy";
import type { Reason } from "@/lib/domain";
import { TicketControls } from "@/components/ticket-controls";
import { AnalysisPanel } from "@/components/analysis-panel";
import { RefreshControl } from "@/components/refresh-control";
const eventNames: Record<string, string> = {
  created: "Customer submitted the request",
  route: "Consultant assigned a team",
  spam: "Moved to spam",
  restore: "Restored to the queue",
};
export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = repository();
  const ticket = repo.get(id);
  if (!ticket) notFound();
  return (
    <>
      <Link className="back" href="/consultant">
        ← Request queue
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">REQUEST #{ticket.id.slice(0, 8)}</p>
          <h1>{ticket.subject}</h1>
        </div>
        <RefreshControl />
      </div>
      <div className="columns detail">
        <div className="stack">
          <section className="panel">
            <div className="section-heading">
              <h2>Request details</h2>
              <span className={`badge ${ticket.status}`}>
                {statusNames[ticket.status]}
              </span>
            </div>
            <p className="ticket-body">{ticket.description}</p>
            <p className="hint">
              Demo customer ·{" "}
              {new Date(ticket.created_at).toLocaleString("en-GB", {
                timeZone: "Europe/Warsaw",
              })}
            </p>
          </section>
          {env().jevEnabled && (
            <AnalysisPanel
              attempt={repo.attempts(id)[0]}
              settings={repo.settings()}
            />
          )}
          <section className="panel">
            <h2>Request history</h2>
            <ol className="timeline">
              {repo.events(id).map((e) => (
                <li key={e.id}>
                  <b>
                    {eventNames[e.kind] ??
                      reasonNames[e.kind as Reason] ??
                      e.kind}
                  </b>
                  <p>
                    {statusNames[e.after.status]}
                    {e.after.department ? ` · ${e.after.department}` : ""}
                  </p>
                  <time>
                    {new Date(e.created_at).toLocaleString("en-GB", {
                      timeZone: "Europe/Warsaw",
                    })}
                  </time>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <aside className="panel decision-panel">
          <p className="eyebrow">YOUR DECISION</p>
          <h2>{ticket.department ?? "Choose the right team"}</h2>
          <p className="muted">
            {ticket.status === "spam"
              ? "Restore this request before assigning it to a team."
              : "The category determines which team receives the request."}
          </p>
          <TicketControls key={ticket.version} ticket={ticket} />
        </aside>
      </div>
    </>
  );
}
