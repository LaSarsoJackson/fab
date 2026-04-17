const TOUCH_LIKE_POINTER_TYPES = new Set(["touch", "pen"]);

export const inferPointerType = (event) => {
  const pointerType = event?.pointerType ?? event?.nativeEvent?.pointerType;
  if (pointerType) {
    return String(pointerType).toLowerCase();
  }

  if (typeof event?.type === "string" && event.type.startsWith("touch")) {
    return "touch";
  }

  return "mouse";
};

export const isTouchLikePointerType = (pointerType) => (
  TOUCH_LIKE_POINTER_TYPES.has(String(pointerType || "").toLowerCase())
);

export const shouldHandleSectionHover = ({
  canHover = true,
  recentTouchInteraction = false,
} = {}) => canHover && !recentTouchInteraction;

export const stopMapInteractionPropagation = (event) => {
  if (!event) return;

  if (typeof event.stopPropagation === "function") {
    event.stopPropagation();
  }

  const nativeEvent = event.nativeEvent;
  if (nativeEvent && typeof nativeEvent.stopPropagation === "function") {
    nativeEvent.stopPropagation();
  }
  if (nativeEvent && typeof nativeEvent.stopImmediatePropagation === "function") {
    nativeEvent.stopImmediatePropagation();
  }
};
