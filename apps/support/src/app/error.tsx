"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty">
      <h1>Could not load the data</h1>
      <p>Please try again. Saved requests remain in the database.</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
