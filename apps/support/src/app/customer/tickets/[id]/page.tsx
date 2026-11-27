import Link from "next/link";
import { notFound } from "next/navigation";
import { repository } from "@/lib/runtime";
import { statusNames } from "@/lib/catalog";
import { RefreshControl } from "@/components/refresh-control";
export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ticket = repository().get(id);
  if (!ticket) notFound();
  return (
    <>
      <Link className="back" href="/customer">
        ← Your requests
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">REQUEST #{ticket.id.slice(0, 8)}</p>
          <h1>{ticket.subject}</h1>
        </div>
        <RefreshControl />
      </div>
      <div className="columns detail">
        <section className="panel">
          <h2>Request details</h2>
          <p className="ticket-body">{ticket.description}</p>
        </section>
        <aside className="panel">
          <span className={`badge ${ticket.status}`}>
            {statusNames[ticket.status]}
          </span>
          <h2 className="spaced">
            {ticket.department ?? "Your request is saved"}
          </h2>
          <p className="muted">
            {ticket.status === "routed"
              ? "Your request has been assigned to this team."
              : ticket.status === "spam"
                ? "This request was marked as spam."
                : "A consultant will review your request and select the right team."}
          </p>
          <p className="hint">Refresh to see the latest status.</p>
        </aside>
      </div>
    </>
  );
}
