import Link from "next/link";
import { env } from "@/lib/env";
export default function Home() {
  const enabled = env().jevEnabled;
  return (
    <>
      <section className="hero">
        <p className="eyebrow">LESS HANDOFF. MORE HELP.</p>
        <h1>
          Every request
          <br />
          in the right place<span>.</span>
        </h1>
        <p className="lead">
          From the first message to the right team.
          <br />
          Experience support from both sides.
        </p>
        <div className="hero-note">
          <span className="dot" />
          {enabled
            ? "Jev reviews new requests. You set the limits of automation."
            : "A consultant makes every decision. You stay in control."}
        </div>
      </section>
      <div className="portal-grid">
        <Link href="/customer" className="portal-card">
          <span className="portal-number">01 / CUSTOMER</span>
          <span className="portal-art">↗</span>
          <h2>I need a hand</h2>
          <p>Submit a request and see which team is handling it.</p>
          <span className="portal-link">
            Go to the customer portal <b>↗</b>
          </span>
        </Link>
        <Link href="/consultant" className="portal-card dark">
          <span className="portal-number">02 / CONSULTANT</span>
          <span className="portal-art">≋</span>
          <h2>Here to help</h2>
          <p>
            Review the queue, make decisions, and adjust automation thresholds
            for Jev.
          </p>
          <span className="portal-link">
            Open the consultant workspace <b>↗</b>
          </span>
        </Link>
      </div>
      <div className="home-bottom">
        <span>ONE WORKFLOW, TWO MODES</span>
        <p>
          Only clear-cut requests are routed automatically.
          <br />
          Everything else goes to a consultant.
        </p>
      </div>
    </>
  );
}
