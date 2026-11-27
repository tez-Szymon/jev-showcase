import "server-only";
import { getDb } from "./db";
import { Repository } from "./repository";
import { env } from "./env";
import { createTicketService } from "./ticket-service";
export const repository = () => new Repository(getDb());
export function ticketService() {
  return createTicketService(repository(), env().jevEnabled, async (input) => {
    const { classifyTicket } = await import("./jev/client");
    return classifyTicket(input);
  });
}
