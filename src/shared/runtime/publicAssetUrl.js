export const buildPublicAssetUrl = (
  path,
  publicUrl = process.env.PUBLIC_URL || ""
) => {
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${String(path || "")}`;

  return `${publicUrl}${normalizedPath}`;
};
