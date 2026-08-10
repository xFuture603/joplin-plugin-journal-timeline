// Keeps src/manifest.json in step with the version semantic-release writes into
// package.json. npm reads package.json, Joplin reads the manifest, and the two
// drifting apart would publish a plugin whose version disagrees with its
// package - so this runs in semantic-release's `prepare` step, before the .jpl
// is built.
//
// Usage: node scripts/set-version.js 1.2.3

const fs = require('fs');
const path = require('path');

const version = process.argv[2];

if (!/^\d+\.\d+\.\d+/.test(version ?? '')) {
	console.error(`Usage: set-version.js <version>  (got: ${version ?? 'nothing'})`);
	process.exit(1);
}

const manifestPath = path.join(__dirname, '..', 'src', 'manifest.json');
const original = fs.readFileSync(manifestPath, 'utf8');

// A targeted replacement rather than parse-and-rewrite, so the file keeps its
// formatting and the release diff shows one changed line. Anchoring to the
// start of the line avoids touching "manifest_version" or "app_min_version".
const updated = original.replace(/^(\s*"version"\s*:\s*)"[^"]*"/m, `$1"${version}"`);

if (updated === original) {
	console.error(`No "version" field found in ${manifestPath}`);
	process.exit(1);
}

fs.writeFileSync(manifestPath, updated);
console.log(`src/manifest.json set to ${version}`);
