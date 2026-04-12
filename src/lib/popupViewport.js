const buildBasePadding = (basePadding) => ({
  topLeft: [basePadding, basePadding],
  bottomRight: [basePadding, basePadding],
});

const getRectSize = (rect = {}) => ({
  width: Math.max(0, (rect.right || 0) - (rect.left || 0)),
  height: Math.max(0, (rect.bottom || 0) - (rect.top || 0)),
});

export const getPopupViewportPadding = ({
  containerRect,
  overlayRect,
  basePadding = 16,
  edgeThreshold = 12,
  dominantCoverage = 0.6,
} = {}) => {
  const padding = buildBasePadding(basePadding);

  if (!containerRect || !overlayRect) {
    return padding;
  }

  const overlapLeft = Math.max(containerRect.left, overlayRect.left);
  const overlapTop = Math.max(containerRect.top, overlayRect.top);
  const overlapRight = Math.min(containerRect.right, overlayRect.right);
  const overlapBottom = Math.min(containerRect.bottom, overlayRect.bottom);

  if (overlapRight <= overlapLeft || overlapBottom <= overlapTop) {
    return padding;
  }

  const overlapWidth = overlapRight - overlapLeft;
  const overlapHeight = overlapBottom - overlapTop;
  const { width: containerWidth, height: containerHeight } = getRectSize(containerRect);
  if (!containerWidth || !containerHeight) {
    return padding;
  }

  const touchesLeft = Math.abs(overlapLeft - containerRect.left) <= edgeThreshold;
  const touchesRight = Math.abs(containerRect.right - overlapRight) <= edgeThreshold;
  const touchesTop = Math.abs(overlapTop - containerRect.top) <= edgeThreshold;
  const touchesBottom = Math.abs(containerRect.bottom - overlapBottom) <= edgeThreshold;

  if (overlapWidth >= containerWidth * dominantCoverage) {
    if (touchesBottom && !touchesTop) {
      padding.bottomRight[1] = Math.ceil(overlapHeight) + basePadding;
      return padding;
    }

    if (touchesTop && !touchesBottom) {
      padding.topLeft[1] = Math.ceil(overlapHeight) + basePadding;
      return padding;
    }
  }

  if (overlapHeight >= containerHeight * dominantCoverage) {
    if (touchesLeft && !touchesRight) {
      padding.topLeft[0] = Math.ceil(overlapWidth) + basePadding;
      return padding;
    }

    if (touchesRight && !touchesLeft) {
      padding.bottomRight[0] = Math.ceil(overlapWidth) + basePadding;
      return padding;
    }
  }

  if (touchesLeft) {
    padding.topLeft[0] = Math.ceil(overlapWidth) + basePadding;
  }
  if (touchesRight) {
    padding.bottomRight[0] = Math.ceil(overlapWidth) + basePadding;
  }
  if (touchesTop) {
    padding.topLeft[1] = Math.ceil(overlapHeight) + basePadding;
  }
  if (touchesBottom) {
    padding.bottomRight[1] = Math.ceil(overlapHeight) + basePadding;
  }

  return padding;
};
