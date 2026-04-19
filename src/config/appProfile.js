import { FAB_APP_PROFILE } from "../features/fab/profile";

// `fab` still runs against one concrete profile today. Keep this file as the
// active-profile boundary for shared shell code, but derive narrower values
// beside the caller instead of expanding a second registry surface here.
export const APP_PROFILE = FAB_APP_PROFILE;

export const getAppFeature = (featureKey) => APP_PROFILE.features?.[featureKey] || null;
