import nextEnv from "@next/env";
import { readFileSync } from "node:fs";
nextEnv.loadEnvConfig(process.cwd());
const { repository } = await import("../src/lib/runtime");
const { createTicketService } = await import("../src/lib/ticket-service");
const fixtures = JSON.parse(
  readFileSync(new URL("../fixtures/tickets.json", import.meta.url), "utf8"),
);
const repo = repository();
const service = createTicketService(repo, false, async () => {
  throw new Error("Seed never calls Jev");
});
for (const input of fixtures) {
  const result = await service.submitTicket(input);
  if (!result.ok) throw new Error(result.message);
}
console.log(
  `Sample data ready. Requests in the database: ${repo.list().length}.`,
);
repo.db.close();
