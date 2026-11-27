import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Jev / Routing playground",
  description: "A conversational RAG demo. Jev decides, your LLM answers.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
