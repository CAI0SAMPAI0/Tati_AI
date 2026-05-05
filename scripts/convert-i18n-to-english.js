#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Simple codemod: replace t('key') / t("key") with English literals from en-US messages.
// Usage: node scripts/convert-i18n-to-english.js --dry

const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const MSG_FILE = path.join(FRONTEND, 'lib', 'i18n', 'messages', 'en-US.ts');

function loadMessages() {
  const src = fs.readFileSync(MSG_FILE, 'utf8');
  // crude extract of the object literal starting at 'export const enUS = '
  const m = src.match(/export const enUS\s*=\s*(\{[\s\S]*\})\s*;?\s*$/m);
  if (!m) throw new Error('Could not extract enUS object from en-US.ts');
  let objLiteral = m[1];

  // Remove trailing functions and replace arrow functions with placeholders
  objLiteral = objLiteral.replace(/:\s*\([^)]+\)\s*=>\s*`[^`]*`/g, ' : "[DYNAMIC]"');
  objLiteral = objLiteral.replace(/:\s*\([^)]+\)\s*=>\s*\([^)]*\)\s*=>\s*`[^`]*`/g, ' : "[DYNAMIC]"');
  objLiteral = objLiteral.replace(/\(n: number\) => `[^`]*`/g, '"[DYNAMIC]"');

  // Remove TypeScript-only imports/references
  objLiteral = objLiteral.replace(/\b[A-Za-z0-9_]+\s*:\s*\([^)]*\)\s*=>\s*[^,}]+/g, '');

  // Attempt to eval the object safely
  let msgs = {};
  try {
    // wrap in parens to make eval return the object
    // eslint-disable-next-line no-new-func
    const fn = new Function('return ' + objLiteral + ';');
    msgs = fn();
  } catch (e) {
    console.error('Could not eval messages object; falling back to approximate parsing. Error:', e.message);
    // Best-effort: parse simple key: 'value' pairs
    const simple = {};
    const pairRe = /([\w$]+)\s*:\s*'([^']*)'/g;
    let match;
    while ((match = pairRe.exec(objLiteral))) {
      simple[match[1]] = match[2];
    }
    msgs = simple;
  }

  // Flatten nested object into dot keys
  function flatten(obj, prefix = '') {
    const out = {};
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'string') out[key] = v;
      else if (typeof v === 'object' && v !== null) Object.assign(out, flatten(v, key));
      else out[key] = String(v);
    }
    return out;
  }

  return flatten(msgs);
}

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (/\.tsx?$/.test(name)) files.push(full);
  }
  return files;
}

function replaceInFile(file, mapping, dry = false, report) {
  let src = fs.readFileSync(file, 'utf8');
  let changed = false;
  const matches = [];
  // Find occurrences of t('key') and t("key") where key is literal
  src = src.replace(/t\(\s*['"]([a-zA-Z0-9_.-]+)['"]\s*\)/g, (m, key) => {
    const mapped = mapping[key];
    if (mapped) {
      changed = true;
      matches.push({ key, replacement: mapped });
      return `"${mapped.replace(/"/g, '\\"')}"`;
    }
    return m;
  });

  if (matches.length > 0) {
    if (dry) {
      report.push({ file, matches });
    } else {
      fs.writeFileSync(file, src, 'utf8');
      console.log('Modified:', file);
    }
  }
}

function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  console.log('Loading messages...');
  const mapping = loadMessages();
  console.log('Found keys:', Object.keys(mapping).length);
  const files = walk(FRONTEND);
  console.log('Scanning files:', files.length);
  const report = [];
  for (const f of files) replaceInFile(f, mapping, dry, report);

  if (dry) {
    const outPath = path.join(ROOT, 'scripts', 'i18n-dry-report.json');
    try {
      fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
      console.log('Dry-run report written to', outPath);
      console.log('Files that would be changed:', report.length);
    } catch (e) {
      console.error('Could not write dry-run report:', e.message);
    }
  }

  console.log('Done.');
}

if (require.main === module) main();
