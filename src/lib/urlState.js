const clean = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

export const parseDeepLinkState = (search = '', tourNames = []) => {
  const query = search.startsWith('?') ? search : `?${search}`;
  const params = new URLSearchParams(query);

  const section = clean(params.get('section'));
  const view = clean(params.get('view')).toLowerCase();
  const textQuery = clean(params.get('q'));
  const rawTour = clean(params.get('tour')).toLowerCase();

  const selectedTourName = rawTour
    ? tourNames.find((tourName) => tourName.toLowerCase().includes(rawTour)) || null
    : null;

  return {
    section,
    query: textQuery,
    view,
    rawTour,
    selectedTourName,
    showBurialsView: view === 'burials',
    showToursView: view === 'tours',
  };
};
