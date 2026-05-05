const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const MSG_FILE = path.join(FRONTEND, 'lib', 'i18n', 'messages', 'en-US.ts');

function loadMapping() {
  const src = fs.readFileSync(MSG_FILE, 'utf8');
  const m = src.match(/export const enUS\s*=\s*(\{[\s\S]*\})\s*;?\s*$/m);
  if (!m) return {};
  let objLiteral = m[1];
  objLiteral = objLiteral.replace(/:\s*\([^)]+\)\s*=>\s*`[^`]*`/g, ' : "[DYNAMIC]"');
  let msgs = {};
  try { msgs = new Function('return '+objLiteral)(); } catch(e){ }
  function flatten(obj, prefix=''){
    const out={}; for(const k of Object.keys(obj)){ const v=obj[k]; const key=prefix?`${prefix}.${k}`:k; if(typeof v==='string') out[key]=v; else if(typeof v==='object'&&v!==null) Object.assign(out, flatten(v,key)); else out[key]=String(v);} return out;
  }
  return flatten(msgs);
}

function walk(dir, files=[]) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (/\.tsx?$/.test(name)) files.push(full);
  }
  return files;
}

const mapping = loadMapping();
const files = walk(FRONTEND);
const keySet = new Set(Object.keys(mapping));
let totalLiteralUses = 0;
let matched = 0;
const examples = [];
for (const f of files) {
  const content = fs.readFileSync(f,'utf8');
  const re = /t\(\s*['"]([\s\S]*?)['"]\s*\)/g;
  let m;
  while ((m = re.exec(content))) {
    totalLiteralUses++;
    const key = m[1];
    if (keySet.has(key)) {
      matched++;
      if (examples.length < 20) examples.push({file:f,key});
    }
  }
}

console.log('Total literal t(...) uses:', totalLiteralUses);
console.log('Matches in en-US mapping:', matched);
console.log('Examples:', examples.slice(0,20));
