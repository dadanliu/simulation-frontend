const fs = require('fs');
const path = require('path');

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function listFiles(targetDir, rootDir) {
  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...listFiles(absolutePath, rootDir));
      continue;
    }

    files.push(toPosix(path.relative(rootDir, absolutePath)));
  }

  return files.sort();
}

function main(distDir) {
  const scenarioRoot = process.cwd();
  const distRoot = path.resolve(scenarioRoot, distDir);
  const files = listFiles(distRoot, scenarioRoot);

  const result = {
    purpose: 'simulate how built files are exposed to the browser by different delivery layers',
    input: {
      builtFilesRoot: toPosix(path.relative(scenarioRoot, distRoot)),
      builtFiles: files,
    },
    modes: [
      {
        mode: 'dev-server',
        role: 'serve fresh files during development',
        behavior: [
          'prefer no-cache headers',
          'returns index.html quickly for local preview',
          'emphasizes iteration speed over long-term caching',
        ],
        exampleUrl: 'http://127.0.0.1:4301',
      },
      {
        mode: 'node-static-server',
        role: 'serve built files directly from an app server',
        behavior: [
          'reads files from disk',
          'responds with basic content-type headers',
          'suitable for small demos or simple deployment',
        ],
        exampleUrl: 'http://127.0.0.1:4302',
      },
      {
        mode: 'nginx-style-static-server',
        role: 'let a reverse proxy or static server expose immutable assets efficiently',
        behavior: [
          'html stays no-cache',
          'hashed assets get long cache-control headers',
          'focuses on stable file serving and caching policy',
        ],
        exampleUrl: 'http://127.0.0.1:4303',
      },
      {
        mode: 'cdn-edge-cache',
        role: 'serve the same files closer to users with cache hit or miss behavior',
        behavior: [
          'simulates x-cache MISS then HIT',
          'reuses long-lived headers for hashed assets',
          'shows how origin files can be re-exposed by an edge layer',
        ],
        exampleUrl: 'http://127.0.0.1:4304',
      },
    ],
    requestChain: [
      'browser requests /',
      'server returns index.html',
      'browser requests /css/app.84d7a5c1.css and /js/app.12ab34cd.js',
      'css triggers /images/logo.77aa33ff.svg',
      'user interaction triggers another image request from app.js',
    ],
    boundaries: {
      responsibleFor: [
        'mapping built files to public URLs',
        'sending content-type and cache headers',
        'returning html, css, js, and asset bytes over HTTP',
      ],
      notResponsibleFor: [
        'building those files in the first place',
        'parsing bytes inside the browser',
        'rendering the final pixels',
      ],
    },
  };

  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main(process.argv[2] || 'demo-dist');
}
