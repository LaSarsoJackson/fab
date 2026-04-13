export const getRuntimeEnv = (env = process.env) => {
  const appEnvironment = env.REACT_APP_ENVIRONMENT === "production"
    ? "production"
    : "development";
  const isDev = appEnvironment !== "production";

  return {
    appEnvironment,
    isDev,
  };
};

export const {
  appEnvironment: APP_ENVIRONMENT,
  isDev: IS_DEV,
} = getRuntimeEnv();
