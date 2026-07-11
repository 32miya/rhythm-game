// Produces play.html: an obfuscated build of index.html for external/public
// linking (e.g. from a game portal site). index.html itself stays as the
// readable source - re-run this script after editing it, before
// (re)deploying play.html.
//
// Usage: cd tools && npm install && node build-obfuscated.js
const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const JavaScriptObfuscator = require('javascript-obfuscator');

const REPO = path.join(__dirname, '..');
const SRC = path.join(REPO, 'index.html');
const OUT = path.join(REPO, 'play.html');

async function build() {
  const html = fs.readFileSync(SRC, 'utf8');
  const scriptMatches = [...html.matchAll(/<script>\n([\s\S]*?)<\/script>/g)];
  if (scriptMatches.length !== 1) {
    throw new Error(`expected exactly one inline <script> block in index.html, found ${scriptMatches.length}`);
  }
  const code = scriptMatches[0][1];

  const minified = await minify(code, { compress: true, mangle: true });
  if (!minified.code) throw new Error('terser produced no output');

  // Deliberately moderate: this game has a real-time 60fps canvas/audio loop,
  // and heavier transforms (control-flow flattening, dead-code injection)
  // add per-call overhead that risks reintroducing the mobile jank this
  // project specifically fixed earlier. Identifier mangling + string-array
  // encoding already make casual reading much harder with near-zero runtime
  // cost; only turn on the heavier options below if you've verified frame
  // timing on a throttled/mobile profile afterward.
  const obfuscated = JavaScriptObfuscator.obfuscate(minified.code, {
    compact: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    identifierNamesGenerator: 'mangled',
    renameGlobals: false,
    selfDefending: false,
    disableConsoleOutput: false,
  }).getObfuscatedCode();

  const outHtml = html.replace(scriptMatches[0][0], '<script>\n' + obfuscated + '\n</script>');
  fs.writeFileSync(OUT, outHtml);
  console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB, source was ${(fs.statSync(SRC).size / 1024).toFixed(0)} KB)`);
}

build().catch(err => { console.error(err); process.exit(1); });
