const fs = require('fs');
const path = require('path');

const directory = path.join(__dirname, 'src');

const replacements = [
  { search: /#54D787/g, replace: '#2563EB' },
  { search: /#28c76f/g, replace: '#2563EB' },
  { search: /green-500/g, replace: 'blue-600' },
  { search: /green-400/g, replace: 'blue-500' },
  { search: /green-600/g, replace: 'blue-700' },
  { search: /green-100/g, replace: 'blue-100' },
  { search: /bg-green-50/g, replace: 'bg-blue-50' },
  { search: /text-green-600/g, replace: 'text-blue-700' }
];

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.match(/\.(tsx|ts|css)$/)) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      for (const { search, replace } of replacements) {
        if (content.match(search)) {
          content = content.replace(search, replace);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

walkDir(directory);
console.log('Color replacement complete.');
