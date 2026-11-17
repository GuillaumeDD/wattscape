import { describe, expect, it } from "vitest";
import { LANDMARKS, type Landmark } from "../src/map/landmarks";
import { landmarkBox, LANDMARK_SPRITES } from "../src/render/art/landmarks";
import { drawModernLandmark, MODERN_LANDMARK_SPRITES } from "../src/render/art/modern-landmarks";
import { fills, isLamp, recorder, spots } from "./recording-brush";

const AX = 40;
const AY = 30;

function drawn(landmark: Landmark, night = false) {
  const brush = recorder(night);
  const done = drawModernLandmark(brush, landmark, landmarkBox(landmark, AX, AY).left, AY);
  return { done, calls: brush.calls };
}

const withDrawing = LANDMARKS.filter((l) => MODERN_LANDMARK_SPRITES.includes(l.sprite));

describe("the modern landmarks (src/render/art/modern-landmarks.ts)", () => {
  it("draws every landmark, in four lots", () => {
    expect([...MODERN_LANDMARK_SPRITES].sort()).toEqual(
      [
        // The first lot.
        "eiffelTower",
        "etretat",
        "harbourLight",
        "montSaintMichel",
        "portCranes",
        "rouenCathedral",
        "seaLighthouse",
        // The second: Hauts-de-France, Grand Est, Centre-Val de Loire.
        "amiensCathedral",
        "chambord",
        "chartresCathedral",
        "hautKoenigsbourg",
        "lilleBelfry",
        "slagHeaps",
        "strasbourgCathedral",
        // The third: Pays de la Loire, Bretagne, Nouvelle-Aquitaine, Occitanie.
        "carcassonne",
        "carnacStones",
        "fortBoyard",
        "nantesCastle",
        "pilatDune",
        "placeDeLaBourse",
        "saltMarshes",
        // The fourth: the centre and the south-east.
        "beauneHospices",
        "besanconCitadel",
        "calanques",
        "fourviere",
        "notreDameDeLaGarde",
        "pontDuGard",
        "puyDeDome",
      ].sort(),
    );
    expect(withDrawing).toHaveLength(MODERN_LANDMARK_SPRITES.length);
    // Every landmark has its drawing now: none falls back to its smoothed sprite.
    expect(withDrawing).toHaveLength(LANDMARKS.length);
  });

  it("draws nothing, and says so, for a landmark with no drawing yet", () => {
    const others = LANDMARKS.filter((l) => !MODERN_LANDMARK_SPRITES.includes(l.sprite));
    expect(others.length).toBe(LANDMARKS.length - withDrawing.length);
    for (const landmark of others) {
      const { done, calls } = drawn(landmark);
      expect(done, landmark.id).toBe(false);
      expect(calls).toHaveLength(0);
    }
  });

  it("stays in the box of the pixel-art sprite, which the captions answer to", () => {
    for (const landmark of withDrawing)
      for (const night of [false, true]) {
        const box = landmarkBox(landmark, AX, AY);
        const { done, calls } = drawn(landmark, night);
        expect(done).toBe(true);
        expect(fills(calls).length, landmark.sprite).toBeGreaterThan(0);
        for (const shape of fills(calls)) {
          expect(shape.left, landmark.sprite).toBeGreaterThanOrEqual(box.left - 0.75);
          expect(shape.right, landmark.sprite).toBeLessThanOrEqual(box.right + 0.75);
          expect(shape.top, landmark.sprite).toBeGreaterThanOrEqual(box.top - 0.75);
          expect(shape.bottom, landmark.sprite).toBeLessThanOrEqual(box.bottom + 0.75);
        }
      }
  });

  it("lights at night the lamps of the pixel-art sprite, as many, and none by day", () => {
    for (const landmark of withDrawing) {
      const lamps = LANDMARK_SPRITES[landmark.sprite].join("").split("L").length - 1;
      expect(fills(drawn(landmark, true).calls).filter(isLamp), landmark.sprite).toHaveLength(
        lamps,
      );
      expect(fills(drawn(landmark, false).calls).filter(isLamp)).toHaveLength(0);
    }
  });

  it("lights the Eiffel Tower plainly: five lamps and their halos, no beam (P-008, P-009)", () => {
    const tower = LANDMARKS.find((l) => l.sprite === "eiffelTower");
    if (tower === undefined) throw new Error("no Eiffel Tower");
    const box = landmarkBox(tower, AX, AY);
    const night = drawn(tower, true).calls;
    expect(fills(night).filter(isLamp)).toHaveLength(5);
    // Every light, halo included, stays about the tower: nothing sweeps the sky.
    const halos = spots(night).filter((s) => s.unlit && s.colour[0] > 0);
    expect(halos).toHaveLength(5);
    for (const light of halos) {
      expect(light.cx - light.rx).toBeGreaterThanOrEqual(box.left - 1);
      expect(light.cx + light.rx).toBeLessThanOrEqual(box.right + 1);
      expect(light.cy - light.ry).toBeGreaterThanOrEqual(box.top - 1);
      expect(light.rx).toBeLessThanOrEqual(1);
    }
  });

  it("draws the same twice", () => {
    for (const landmark of withDrawing)
      for (const night of [false, true])
        expect(JSON.stringify(drawn(landmark, night).calls)).toBe(
          JSON.stringify(drawn(landmark, night).calls),
        );
  });
});
