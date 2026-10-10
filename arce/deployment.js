export function getArceDeployment(target = 'dev') {
  if (!['dev', 'production', 'github-pages'].includes(target)) throw new Error('ARCE target must be dev, production or github-pages.');
  if (target === 'github-pages') return {
    target,
    origin: 'https://lasarsojackson.github.io',
    sitePath: '/fab/arce/',
    outputDir: 'arce-pages-build',
    cachePrefix: 'fab-arce-pages-v',
  };
  return {
    target,
    origin: 'https://www.albany.edu',
    sitePath: target === 'dev' ? '/arce/dev/' : '/arce/',
    outputDir: target === 'dev' ? 'arce-dev-upload' : 'arce-upload',
    cachePrefix: target === 'dev' ? 'fab-arce-dev-v' : 'fab-arce-v',
  };
}
