import Link from "next/link";
import { repository } from "@/lib/runtime";
import { ThresholdForm } from "@/components/threshold-form";
export default function SettingsPage() {
  const settings = repository().settings();
  return (
    <>
      <Link className="back" href="/consultant">
        ← Consultant workspace
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SETTINGS / VERSION {settings.version}</p>
          <h1>You set the boundaries.</h1>
          <p className="muted">
            Choose which requests Jev can route automatically.
          </p>
        </div>
      </div>
      <div className="columns detail">
        <section className="panel">
          <h2>Automation thresholds</h2>
          <ThresholdForm key={settings.version} settings={settings} />
        </section>
        <aside className="panel guidance">
          <span className="big-symbol">≋</span>
          <h2>
            Two conditions.
            <br />
            One decision.
          </h2>
          <p>
            Jev routes a request when confidence and the difference between the
            two highest probabilities meet your thresholds.
          </p>
          <p>
            Automation covers technical issues, complaints, offers, and spam,
            which goes straight to the spam queue. Mixed, unclear, and other
            requests always need a consultant.
          </p>
          <hr />
          <p>
            Changes apply to analyses started after saving. Previous decisions
            stay unchanged.
          </p>
          <p className="hint">
            Confidence measures how concentrated the distribution is, not the
            percentage of correct decisions. Evaluate the initial thresholds on
            your own requests.
          </p>
        </aside>
      </div>
    </>
  );
}
