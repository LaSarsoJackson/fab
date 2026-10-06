export function getArceDeployment(target = 'dev') {
  if (!['dev', 'production'].includes(target)) throw new Error('ARCE target must be dev or production.');
  return {
    target,
    sitePath: target === 'dev' ? '/arce/dev/' : '/arce/',
    outputDir: target === 'dev' ? 'arce-dev-upload' : 'arce-upload',
    cachePrefix: target === 'dev' ? 'fab-arce-dev-v' : 'fab-arce-v',
  };
}
