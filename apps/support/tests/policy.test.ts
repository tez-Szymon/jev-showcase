import { describe, it, expect } from "vitest";
import { decideRouting } from "../src/lib/jev/policy";
import { defaults } from "../src/lib/domain";
import { analysis } from "./fixtures/jev";
const settings = { ...defaults, version: 1 };
describe("automation policy", () => {
  it.each(["technical", "complaint", "offer"] as const)(
    "routes %s when both gates pass",
    (label) => {
      expect(decideRouting(analysis(label), settings)).toMatchObject({
        action: "route",
        category: label,
      });
    },
  );
  it("moves confident spam straight to the spam queue", () => {
    expect(decideRouting(analysis("spam", 0.95), settings)).toEqual({
      action: "spam",
      reason: "auto_spam",
    });
  });
  it("keeps uncertain spam for a consultant", () => {
    expect(decideRouting(analysis("spam", 0.85), settings).reason).toBe(
      "low_confidence",
    );
    expect(
      decideRouting(analysis("spam", 0.95), {
        ...settings,
        categoryOverrides: { spam: 0.99 },
      }).action,
    ).toBe("review");
  });
  it.each(["mixed", "other", "insufficient"] as const)(
    "always reviews %s",
    (label) => {
      expect(decideRouting(analysis(label, 1), settings)).toEqual({
        action: "review",
        reason: "special_label",
      });
    },
  );
  it("accepts equality at both thresholds", () => {
    const a = analysis("technical", 0.9);
    a.probabilities = {
      technical: 0.6,
      complaint: 0.4,
      offer: 0,
      other: 0,
      mixed: 0,
      insufficient: 0,
      spam: 0,
    };
    expect(decideRouting(a, settings).action).toBe("route");
  });
  it("requires both gates independently", () => {
    expect(decideRouting(analysis("technical", 0.89), settings).reason).toBe(
      "low_confidence",
    );
    expect(
      decideRouting(analysis(), { ...settings, minMargin: 0.94 }).reason,
    ).toBe("small_margin");
  });
  it("uses category override instead of global threshold", () => {
    expect(
      decideRouting(analysis("technical", 0.85), {
        ...settings,
        categoryOverrides: { technical: 0.8 },
      }).action,
    ).toBe("route");
    expect(
      decideRouting(analysis("offer", 0.85), {
        ...settings,
        categoryOverrides: { technical: 0.8 },
      }).action,
    ).toBe("review");
  });
  it.each([NaN, Infinity, -0.01, 1.01])(
    "rejects invalid confidence %s",
    (confidence) => {
      expect(
        decideRouting(analysis("technical", confidence), settings).reason,
      ).toBe("invalid_result");
    },
  );
  it("rejects inconsistent, incomplete and incompatible answers", () => {
    const a = analysis();
    expect(decideRouting({ ...a, choice: "offer" }, settings).reason).toBe(
      "invalid_result",
    );
    expect(
      decideRouting(
        { ...a, probabilities: { ...a.probabilities, technical: 0.5 } },
        settings,
      ).reason,
    ).toBe("invalid_result");
    expect(
      decideRouting({ ...a, questionVersion: "old" }, settings).reason,
    ).toBe("invalid_result");
    const bad = JSON.parse(JSON.stringify(a));
    delete bad.probabilities.spam;
    expect(decideRouting(bad, settings).reason).toBe("invalid_result");
    bad.probabilities.spam = 0.01;
    bad.probabilities.extra = 0;
    expect(decideRouting(bad, settings).reason).toBe("invalid_result");
  });
});
