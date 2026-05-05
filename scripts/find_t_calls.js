const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');

function walk(dir, files=[]) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (/\.tsx?$/.test(name)) files.push(full);
  }
  return files;
}

const files = walk(FRONTEND);
const found = [];
for (const f of files) {
  const content = fs.readFileSync(f,'utf8');
  if (content.indexOf("t(") !== -1) found.push(f);
}

console.log('Files with t(:', found.length);
for (let i=0;i<Math.min(200,found.length);i++) console.log(found[i]);
