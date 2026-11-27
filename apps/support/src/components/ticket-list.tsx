import Link from "next/link";
import type { Ticket } from "@/lib/domain";
import { statusNames } from "@/lib/catalog";
export function TicketList({
  tickets,
  portal,
}: {
  tickets: Ticket[];
  portal: "customer" | "consultant";
}) {
  if (!tickets.length)
    return (
      <div className="empty">
        <span>◎</span>
        <h3>Requests will appear here</h3>
        <p>There are no requests in this queue yet.</p>
      </div>
    );
  return (
    <div className="ticket-list">
      {tickets.map((t) => (
        <Link
          className="ticket-row"
          href={`/${portal}/tickets/${t.id}`}
          key={t.id}
        >
          <div className="ticket-icon">
            {t.status === "routed" ? "↗" : t.status === "spam" ? "⊘" : "◷"}
          </div>
          <div className="ticket-main">
            <div className="ticket-meta">
              #{t.id.slice(0, 8)} ·{" "}
              {new Date(t.created_at).toLocaleString("en-GB", {
                timeZone: "Europe/Warsaw",
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <h3>{t.subject}</h3>
            <p>
              {t.department ?? "Awaiting assignment"}
              {t.decision_by === "jev" ? " · Jev decision" : ""}
            </p>
          </div>
          <span className={`badge ${t.status}`}>{statusNames[t.status]}</span>
          <span className="arrow">↗</span>
        </Link>
      ))}
    </div>
  );
}
