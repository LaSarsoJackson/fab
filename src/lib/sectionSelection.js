const normalizeSectionValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

export const shouldIgnoreSectionBackgroundSelection = ({
  clickedSection,
  activeSection,
} = {}) => {
  const nextClickedSection = normalizeSectionValue(clickedSection);
  if (!nextClickedSection) {
    return false;
  }

  return nextClickedSection === normalizeSectionValue(activeSection);
};
