const ARCE_ROOT = "https://www.albany.edu/arce";
const clean = (value) => String(value || "").trim();

export const ARCE_HOME_URL = `${ARCE_ROOT}/`;

export const resolveArceBiographyUrl = (value) => {
  const candidate = clean(value);
  if (!candidate || /\.(?:jpe?g|png|gif|webp|svg)$/i.test(candidate)) return "";

  try {
    const url = new URL(candidate, `${ARCE_ROOT}/`);
    if (url.origin !== "https://www.albany.edu" || !url.pathname.startsWith("/arce/")) return "";
    if (!/\.html?$/i.test(url.pathname)) url.pathname = `${url.pathname.replace(/\/$/, "")}.html`;
    return url.toString();
  } catch {
    return "";
  }
};

export const resolveArceImageUrl = (value) => {
  const imageName = clean(value);
  const fileName = !imageName || /^none$/i.test(imageName)
    ? "no-image.jpg"
    : /\.[a-z0-9]+$/i.test(imageName) ? imageName : `${imageName}.jpg`;
  return `${ARCE_ROOT}/images/${fileName}`;
};
