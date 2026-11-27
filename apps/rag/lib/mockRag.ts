import { employees, hrPolicy } from "@/data/hr";
import { productDocs } from "@/data/productDocs";
import { customers } from "@/data/crm";
import type { ConversationState, Document, Domain } from "@/types";
export function retrieveMockContext(
  route: Domain,
  message: string,
  state: ConversationState,
): Document[] {
  const q = message.toLowerCase();
  if (route === "HR") {
    if (/policy|roll.?over|per year|annual|rules/.test(q))
      return [{ id: "hr-policy", title: "Time-off policy", text: hrPolicy }];
    const explicit = employees.find((e) =>
      e.aliases.some((a) => q.includes(a)),
    );
    const self = /\b(i|my|me)\b/.test(q);
    const followup = /^(and|what about|how about|when|how many|what is)/.test(
      q,
    );
    const person =
      explicit ??
      (self
        ? employees[0]
        : followup && state.dataDomain === "HR"
          ? employees.find(
              (e) =>
                e.name === state.subject ||
                e.aliases.includes(state.subject?.toLowerCase() ?? ""),
            )
          : undefined);
    return person
      ? [
          {
            id: `hr-${person.department.toLowerCase()}`,
            title: `${person.name} · ${person.department}`,
            text: `${person.name} has ${person.remainingDays} vacation days remaining.`,
          },
        ]
      : [];
  }
  if (route === "PRODUCT_DOCS") {
    const combined = /sso|sign.on|csv|export|retention/.test(q)
      ? q
      : `${q} ${state.dataDomain === route ? (state.topic ?? "") : ""}`;
    return productDocs.filter((d) =>
      d.id === "product-sso"
        ? /sso|sign.on/.test(combined)
        : d.id === "product-export"
          ? /csv|export/.test(combined)
          : /retention/.test(combined),
    );
  }
  const customer =
    customers.find((c) => q.includes(c.name.toLowerCase())) ??
    (state.dataDomain === "CRM" && /^(and|what|when|who|how)/.test(q)
      ? customers.find((c) => c.name === state.subject)
      : undefined);
  return customer
    ? [
        {
          id: `crm-${customer.name.toLowerCase()}`,
          title: `${customer.name} · Account`,
          text: `${customer.name} is on the ${customer.plan} plan. ARR: ${customer.arr}. Account owner: ${customer.owner}. Renewal date: ${customer.renewal}.`,
        },
      ]
    : [];
}
