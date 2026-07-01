import { describe, expect, it } from "vitest";
import { calculatePointerPush } from "./PotionMotion";

describe("calculatePointerPush", () => {
  it("pushes nearby dots in the pointer movement direction", () => {
    const nearPush = calculatePointerPush({
      dotX: 110,
      dotY: 100,
      pointerX: 100,
      pointerY: 100,
      velocityX: 8,
      velocityY: 0,
      active: 1
    });
    const farPush = calculatePointerPush({
      dotX: 260,
      dotY: 100,
      pointerX: 100,
      pointerY: 100,
      velocityX: 8,
      velocityY: 0,
      active: 1
    });

    expect(nearPush.x).toBeGreaterThan(0);
    expect(Math.abs(nearPush.x)).toBeGreaterThan(Math.abs(farPush.x));
    expect(Math.abs(nearPush.y)).toBeLessThan(0.001);
  });

  it("reverses push direction when pointer movement reverses", () => {
    const push = calculatePointerPush({
      dotX: 110,
      dotY: 100,
      pointerX: 100,
      pointerY: 100,
      velocityX: -8,
      velocityY: 0,
      active: 1
    });

    expect(push.x).toBeLessThan(0);
  });
});
