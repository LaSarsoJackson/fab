import { describe, expect, test } from "bun:test";
import {
  inferPointerType,
  isTouchLikePointerType,
  shouldHandleSectionHover,
  stopMapInteractionPropagation,
} from "../src/features/map/interactionGuards";

describe("interactionGuards", () => {
  test("treats touch and pen pointers as touch-like", () => {
    expect(isTouchLikePointerType("touch")).toBe(true);
    expect(isTouchLikePointerType("pen")).toBe(true);
    expect(isTouchLikePointerType("mouse")).toBe(false);
  });

  test("infers pointer type from pointer, touch, and fallback events", () => {
    expect(inferPointerType({ pointerType: "pen" })).toBe("pen");
    expect(inferPointerType({ nativeEvent: { pointerType: "touch" } })).toBe("touch");
    expect(inferPointerType({ type: "touchstart" })).toBe("touch");
    expect(inferPointerType({ type: "mousemove" })).toBe("mouse");
  });

  test("suppresses section hover after touch input or when hover is unavailable", () => {
    expect(shouldHandleSectionHover({
      canHover: true,
      recentTouchInteraction: false,
    })).toBe(true);

    expect(shouldHandleSectionHover({
      canHover: true,
      recentTouchInteraction: true,
    })).toBe(false);

    expect(shouldHandleSectionHover({
      canHover: false,
      recentTouchInteraction: false,
    })).toBe(false);
  });

  test("stops propagation on synthetic and native events", () => {
    const calls = [];
    const nativeEvent = {
      stopPropagation: () => calls.push("native-stop"),
      stopImmediatePropagation: () => calls.push("native-immediate"),
    };
    const event = {
      nativeEvent,
      stopPropagation: () => calls.push("react-stop"),
    };

    stopMapInteractionPropagation(event);

    expect(calls).toEqual([
      "react-stop",
      "native-stop",
      "native-immediate",
    ]);
  });
});
