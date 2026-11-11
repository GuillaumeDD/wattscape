import { describe, expect, it } from "vitest";
import { moonPhase, SYNODIC_MONTH_DAYS } from "../src/sky/moon";
import { SKY_REFERENCE } from "./sky-reference";

function phase(time: string | number) {
  const p = moonPhase(typeof time === "number" ? time : Date.parse(time));
  if (p === null) throw new Error("no phase");
  return p;
}

/** Gap in days between the computed cycle and a quarter, the shorter way round. */
function gapDays(cycle: number, quarter: number): number {
  const d = cycle - quarter / 4;
  return Math.abs(d - Math.round(d)) * SYNODIC_MONTH_DAYS;
}

describe("moonPhase against an independent ephemeris (S-012)", () => {
  const quarters = SKY_REFERENCE.moonQuarters;

  it("covers every quarter from 2026 to 2030", () => {
    expect(quarters.length).toBeGreaterThan(240);
    expect(quarters[0]?.time.startsWith("2026-01")).toBe(true);
    expect(quarters.at(-1)?.time.startsWith("2030-12")).toBe(true);
  });

  it("puts every new, first quarter, full and last quarter moon within 1 day (measured: 0.8)", () => {
    let worst = 0;
    for (const q of quarters) worst = Math.max(worst, gapDays(phase(q.time).cycle, q.quarter));
    expect(worst).toBeLessThan(1);
    expect(worst).toBeGreaterThan(0.5); // the mean month really drifts: the test is not vacuous
  });

  it("is dark at the new moons and fully lit at the full moons, within a day's change", () => {
    for (const q of quarters.filter((x) => x.quarter === 0))
      expect(phase(q.time).illuminated).toBeLessThan(0.07);
    for (const q of quarters.filter((x) => x.quarter === 2))
      expect(phase(q.time).illuminated).toBeGreaterThan(0.93);
  });
});

describe("moonPhase, arithmetic", () => {
  it("keeps age, cycle and lit fraction in range, before and after the reference moon", () => {
    for (const time of [
      "1990-05-01T00:00:00Z",
      "2000-01-06T14:20:00Z",
      "2026-11-11T12:00:00Z",
      "2099-12-31T23:59:00Z",
    ]) {
      const p = phase(time);
      expect(p.ageDays).toBeGreaterThanOrEqual(0);
      expect(p.ageDays).toBeLessThan(SYNODIC_MONTH_DAYS);
      expect(p.cycle).toBeGreaterThanOrEqual(0);
      expect(p.cycle).toBeLessThan(1);
      expect(p.illuminated).toBeGreaterThanOrEqual(0);
      expect(p.illuminated).toBeLessThanOrEqual(1);
    }
  });

  it("advances by one day per day and comes back after a synodic month", () => {
    const t = Date.parse("2026-11-11T12:00:00Z");
    const a = phase(t);
    expect(phase(t + 86_400_000).ageDays - a.ageDays).toBeCloseTo(1, 9);
    expect(phase(t + SYNODIC_MONTH_DAYS * 86_400_000).cycle).toBeCloseTo(a.cycle, 9);
  });

  it("returns null for a non-finite time", () => {
    expect(moonPhase(Number.NaN)).toBeNull();
    expect(moonPhase(Number.NEGATIVE_INFINITY)).toBeNull();
  });
});
