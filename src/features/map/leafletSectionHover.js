const normalizeSectionId = (sectionId) => {
  if (sectionId === null || sectionId === undefined || sectionId === "") {
    return null;
  }

  return String(sectionId);
};

export const createLeafletSectionHoverState = ({
  sectionId = null,
  layer = null,
} = {}) => ({
  sectionId: normalizeSectionId(sectionId),
  layer: layer || null,
});

export const beginLeafletSectionHover = (currentHoverState, nextHoverState) => {
  const currentState = createLeafletSectionHoverState(currentHoverState);
  const nextState = createLeafletSectionHoverState(nextHoverState);

  return {
    clearedHoverState:
      currentState.layer && currentState.layer !== nextState.layer
        ? currentState
        : null,
    nextHoverState: nextState,
  };
};

export const clearLeafletSectionHover = (currentHoverState) => {
  const currentState = createLeafletSectionHoverState(currentHoverState);

  return {
    clearedHoverState: currentState.layer ? currentState : null,
    nextHoverState: createLeafletSectionHoverState(),
  };
};

export const isLeafletSectionLayerHovered = (currentHoverState, layer) => (
  Boolean(layer) && currentHoverState?.layer === layer
);
