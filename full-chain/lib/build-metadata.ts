export type BuildMetadata = {
  buildLabel: string;
  generatedAt: string;
  deliveryPath: string[];
};

export function createBuildMetadata(): BuildMetadata {
  return {
    buildLabel: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local-build',
    generatedAt: new Date().toISOString(),
    deliveryPath: ['GitHub', 'CI', 'next build', 'CDN / Node SSR', 'Browser'],
  };
}
