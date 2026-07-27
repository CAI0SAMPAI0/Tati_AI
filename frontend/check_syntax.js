const fs = require('fs');
const content = fs.readFileSync('C:/Users/CAIO/projects/Tati_AI/frontend/components/dashboard/cefr-section.tsx', 'utf-8');
const lines = content.split('\n');

// Check parenthesis balance up to line 808
let parens = 0;
for (let i = 0; i < 808; i++) {
  const line = lines[i];
  let inStr = false;
  let strChar = '';
  let inLineComment = false;
  let inBlockComment = false;
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    const next = line[j+1] || '';
    if (inLineComment) { if (c === '\n') inLineComment = false; continue; }
    if (inBlockComment) { if (c === '*' && next === '/') { inBlockComment = false; j++; } continue; }
    if (inStr) { if (c === strChar && line[j-1] !== '\\') inStr = false; continue; }
    if (c === '/' && next === '/') { inLineComment = true; j++; continue; }
    if (c === '/' && next === '*') { inBlockComment = true; j++; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = true; strChar = c; continue; }
    if (c === '(') parens++;
    if (c === ')') parens--;
  }
}
console.log('Parens at line 808:', parens);

// Find where parens become -1
parens = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let inStr = false;
  let strChar = '';
  let inLineComment = false;
  let inBlockComment = false;
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    const next = line[j+1] || '';
    if (inLineComment) { if (c === '\n') inLineComment = false; continue; }
    if (inBlockComment) { if (c === '*' && next === '/') { inBlockComment = false; j++; } continue; }
    if (inStr) { if (c === strChar && line[j-1] !== '\\') inStr = false; continue; }
    if (c === '/' && next === '/') { inLineComment = true; j++; continue; }
    if (c === '/' && next === '*') { inBlockComment = true; j++; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = true; strChar = c; continue; }
    if (c === '(') parens++;
    if (c === ')') parens--;
  }
  if (parens < 0) {
    console.log('Parens went negative at line', i+1, ':', line.trim().substring(0, 80));
    console.log('Parens:', parens);
    break;
  }
}
