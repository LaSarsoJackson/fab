const normalizeBurialId = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const nextValue = String(value).trim();
  return nextValue || null;
};

const dedupeSelectedBurials = (selectedBurials = []) => {
  const seenIds = new Set();
  const nextSelectedBurials = [];

  selectedBurials.forEach((burial) => {
    const burialId = normalizeBurialId(burial?.id);
    if (!burialId || seenIds.has(burialId)) {
      return;
    }

    seenIds.add(burialId);
    nextSelectedBurials.push(burial);
  });

  return nextSelectedBurials;
};

const upsertSelectedBurial = (selectedBurials = [], burial) => {
  const burialId = normalizeBurialId(burial?.id);
  if (!burialId) {
    return dedupeSelectedBurials(selectedBurials);
  }

  let didReplace = false;
  const nextSelectedBurials = dedupeSelectedBurials(selectedBurials).map((record) => {
    if (record.id !== burialId) {
      return record;
    }

    didReplace = true;
    return burial;
  });

  if (!didReplace) {
    nextSelectedBurials.push(burial);
  }

  return nextSelectedBurials;
};

export const createMapSelectionState = ({
  selectedBurials = [],
  activeBurialId = null,
  hoveredBurialId = null,
} = {}) => {
  const nextSelectedBurials = dedupeSelectedBurials(selectedBurials);
  const selectedBurialIds = new Set(nextSelectedBurials.map((burial) => burial.id));
  const nextActiveBurialId = normalizeBurialId(activeBurialId);

  return {
    selectedBurials: nextSelectedBurials,
    activeBurialId: nextActiveBurialId && selectedBurialIds.has(nextActiveBurialId)
      ? nextActiveBurialId
      : null,
    hoveredBurialId: normalizeBurialId(hoveredBurialId),
  };
};

export const focusSelectionBurial = (selectionState, burial) => {
  const burialId = normalizeBurialId(burial?.id);
  if (!burialId || !burial) {
    return createMapSelectionState(selectionState);
  }

  return createMapSelectionState({
    ...selectionState,
    selectedBurials: upsertSelectedBurial(selectionState?.selectedBurials, burial),
    activeBurialId: burialId,
  });
};

export const replaceSelectionBurials = (
  selectionState,
  {
    selectedBurials = [],
    activeBurialId = null,
    hoveredBurialId = null,
  } = {}
) => (
  createMapSelectionState({
    ...selectionState,
    selectedBurials,
    activeBurialId,
    hoveredBurialId,
  })
);

export const removeSelectionBurial = (selectionState, burialId) => {
  const normalizedBurialId = normalizeBurialId(burialId);
  const nextSelectedBurials = (selectionState?.selectedBurials || []).filter((burial) => burial.id !== normalizedBurialId);

  return createMapSelectionState({
    ...selectionState,
    selectedBurials: nextSelectedBurials,
    activeBurialId: selectionState?.activeBurialId === normalizedBurialId
      ? null
      : selectionState?.activeBurialId,
    hoveredBurialId: selectionState?.hoveredBurialId === normalizedBurialId
      ? null
      : selectionState?.hoveredBurialId,
  });
};

export const clearSelectionFocus = (
  selectionState,
  { clearHover = false } = {}
) => (
  createMapSelectionState({
    ...selectionState,
    activeBurialId: null,
    hoveredBurialId: clearHover ? null : selectionState?.hoveredBurialId,
  })
);

export const setSelectionHover = (selectionState, hoveredBurialId) => (
  createMapSelectionState({
    ...selectionState,
    hoveredBurialId,
  })
);

export const refreshSelectionBurials = (selectionState, getNextBurial) => {
  if (typeof getNextBurial !== "function") {
    return createMapSelectionState(selectionState);
  }

  const nextSelectedBurials = (selectionState?.selectedBurials || []).map((burial) => (
    getNextBurial(burial) || burial
  ));

  return createMapSelectionState({
    ...selectionState,
    selectedBurials: nextSelectedBurials,
  });
};
