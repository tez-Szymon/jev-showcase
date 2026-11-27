export default function FlowStep({
  label,
  detail,
  kind = "",
  muted = false,
}: {
  label: string;
  detail?: string;
  kind?: string;
  muted?: boolean;
}) {
  return (
    <div className={`flow-step ${kind} ${muted ? "muted" : ""}`}>
      <span>{label}</span>
      {detail && <small>{detail}</small>}
    </div>
  );
}
