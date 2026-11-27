import Link from "next/link";
import { repository } from "@/lib/runtime";
import { statusNames } from "@/lib/catalog";
import type { Status } from "@/lib/domain";
import { TicketList } from "@/components/ticket-list";
import { RefreshControl } from "@/components/refresh-control";
export default async function ConsultantPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter: Status =
    status === "routed" || status === "spam" ? status : "needs_review";
  const all = repository().list();
  const automatic = all.filter((t) => t.decision_by === "jev").length;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CONSULTANT WORKSPACE</p>
          <h1>A good day to lend a hand.</h1>
          <p className="muted">
            Every request in one place. Every decision under your control.
          </p>
        </div>
        <Link className="button" href="/consultant/settings">
          ⚙ Automation thresholds
        </Link>
      </div>
      <div className="stats">
        <div>
          <span>Needs review</span>
          <strong>
            {all.filter((t) => t.status === "needs_review").length}
            <small>requests in the queue</small>
          </strong>
        </div>
        <div>
          <span>Assigned to teams</span>
          <strong>
            {all.filter((t) => t.status === "routed").length}
            <small>assigned requests</small>
          </strong>
        </div>
        <div className="accent-stat">
          <span>Automated decisions</span>
          <strong>
            {automatic}
            <small>current Jev assignments</small>
          </strong>
        </div>
      </div>
      <section className="panel queue">
        <div className="section-heading">
          <h2>Request queue</h2>
          <RefreshControl />
        </div>
        <nav className="tabs" aria-label="Status filter">
          {Object.entries(statusNames).map(([key, name]) => (
            <Link
              key={key}
              className={filter === key ? "active" : ""}
              aria-current={filter === key ? "page" : undefined}
              href={`/consultant?status=${key}`}
            >
              {name}
              <span>{all.filter((t) => t.status === key).length}</span>
            </Link>
          ))}
        </nav>
        <TicketList
          tickets={all.filter((t) => t.status === filter)}
          portal="consultant"
        />
      </section>
    </>
  );
}
