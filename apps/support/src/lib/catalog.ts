export const categories = ["technical", "complaint", "offer", "other"] as const;
export const labels = [...categories, "mixed", "insufficient", "spam"] as const;
export const automaticCategories = ["technical", "complaint", "offer"] as const;
// Labels Jev may apply without a consultant (each can have its own threshold).
export const automaticLabels = [...automaticCategories, "spam"] as const;
export const catalog = {
  technical: { name: "Technical issue", department: "IT" },
  complaint: { name: "Complaint", department: "Complaints" },
  offer: { name: "Offers and services", department: "Marketing" },
  other: { name: "Other request", department: "Customer support" },
};
export const labelNames = {
  ...Object.fromEntries(Object.entries(catalog).map(([k, v]) => [k, v.name])),
  mixed: "Multiple equally important requests",
  insufficient: "Not enough information",
  spam: "Suspected spam",
} as Record<(typeof labels)[number], string>;
export const statusNames = {
  needs_review: "Needs review",
  routed: "Assigned",
  spam: "Spam",
};
export const questionVersion = "isp-routing-v2-en-catalog-v2";
