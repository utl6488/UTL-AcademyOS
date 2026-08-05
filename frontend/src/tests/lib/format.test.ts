import { describe, it, expect } from "vitest";
import { formatTimer, formatDuration, formatPercent, formatCurrency } from "@/lib/format";

describe("formatTimer", () => {
  it("formats seconds to MM:SS", () => {
    expect(formatTimer(90)).toBe("01:30");
    expect(formatTimer(0)).toBe("00:00");
    expect(formatTimer(59)).toBe("00:59");
  });

  it("formats with hours when > 3600", () => {
    expect(formatTimer(3661)).toBe("01:01:01");
    expect(formatTimer(7200)).toBe("02:00:00");
  });
});

describe("formatDuration", () => {
  it("formats small durations", () => {
    expect(formatDuration(30)).toBe("30s");
    expect(formatDuration(90)).toBe("1m 30s");
  });

  it("formats hours", () => {
    expect(formatDuration(3600)).toBe("1h 0m");
    expect(formatDuration(3660)).toBe("1h 1m");
  });
});

describe("formatPercent", () => {
  it("formats with default decimal", () => {
    expect(formatPercent(85.678)).toBe("85.7%");
    expect(formatPercent(100)).toBe("100.0%");
  });

  it("respects decimals parameter", () => {
    expect(formatPercent(85.678, 2)).toBe("85.68%");
    expect(formatPercent(85.678, 0)).toBe("86%");
  });
});

describe("formatCurrency", () => {
  it("formats INR by default", () => {
    const result = formatCurrency(1000);
    expect(result).toContain("1,000");
  });
});
