import { randomUUID } from "node:crypto";
import { repository } from "@/lib/runtime";
import { env } from "@/lib/env";
import { TicketForm } from "@/components/ticket-form";
import { TicketList } from "@/components/ticket-list";
import { RefreshControl } from "@/components/refresh-control";
export default function ClientPage() {
  const tickets = repository().list();
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CUSTOMER PORTAL</p>
          <h1>How can we help?</h1>
          <p className="muted">
            Tell us what is going on. We will get your request to the right
            team.
          </p>
        </div>
      </div>
      <div className="columns">
        <section className="panel">
          <div className="section-heading">
            <h2>New request</h2>
            <span className="tiny-label">01</span>
          </div>
          <TicketForm submissionId={randomUUID()} enabled={env().jevEnabled} />
        </section>
        <section>
          <div className="section-heading">
            <h2>
              Your requests <span className="count">{tickets.length}</span>
            </h2>
            <RefreshControl />
          </div>
          <TicketList tickets={tickets} portal="customer" />
        </section>
      </div>
    </>
  );
}
