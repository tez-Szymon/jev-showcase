import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty">
      <h1>Request not found</h1>
      <p>Check the address or return to your request list.</p>
      <Link className="button" href="/">
        Back to home
      </Link>
    </div>
  );
}
