export const ADMIN_HASH = "#/admin";

export const isAdminHash = (hash = "") => (
  hash === ADMIN_HASH || hash.startsWith(`${ADMIN_HASH}?`)
);
