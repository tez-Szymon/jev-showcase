import type { Analysis, Label } from "../../src/lib/domain";
import { questionVersion } from "../../src/lib/catalog";
export function analysis(
  choice: Label = "technical",
  confidence = 0.95,
): Analysis {
  const probabilities = {
    technical: 0.01,
    complaint: 0.01,
    offer: 0.01,
    other: 0.01,
    mixed: 0.01,
    insufficient: 0.01,
    spam: 0.01,
  };
  probabilities[choice] = 0.94;
  return {
    choice,
    confidence,
    probabilities,
    model: "test-transport",
    questionVersion,
  };
}
