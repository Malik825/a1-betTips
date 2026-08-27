const fs = require('fs');
const path = require('path');

const directory = path.join(__dirname, 'src');

const replacements = [
  { search: /#2563EB/g, replace: '#FCB708' },
  { search: /blue-600/g, replace: 'amber-500' },
  { search: /blue-500/g, replace: 'amber-400' },
  { search: /blue-700/g, replace: 'amber-600' },
  { search: /blue-100/g, replace: 'amber-100' },
  { search: /bg-blue-50/g, replace: 'bg-amber-50' },
  { search: /text-blue-700/g, replace: 'text-amber-600' },
  { search: /rgba\(37,99,235/g, replace: 'rgba(252,183,8' }
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
