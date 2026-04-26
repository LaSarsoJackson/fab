const { createProxyMiddleware } = require("http-proxy-middleware");
const {
  defaultLocalValhallaProxyPath,
  defaultLocalValhallaProxyTarget,
} = require("./shared/routing/routingDefaults.json");

const DEFAULT_PROXY_PATH = defaultLocalValhallaProxyPath;
const DEFAULT_TARGET = defaultLocalValhallaProxyTarget;

module.exports = function setupProxy(app) {
  const proxyPath = String(
    process.env.REACT_APP_VALHALLA_PROXY_PATH || DEFAULT_PROXY_PATH
  ).trim() || DEFAULT_PROXY_PATH;
  const target = String(
    process.env.FAB_VALHALLA_ORIGIN ||
    process.env.REACT_APP_VALHALLA_ORIGIN ||
    DEFAULT_TARGET
  ).trim() || DEFAULT_TARGET;

  app.use(
    proxyPath,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: (path) => {
        const rewrittenPath = path.slice(proxyPath.length);
        return rewrittenPath || "/";
      },
    })
  );
};
