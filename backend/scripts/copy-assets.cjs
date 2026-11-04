const fs = require('node:fs');
for (const directory of ['docs', 'mail-template', 'migrations']) {
  fs.cpSync(`src/${directory}`, `dist/${directory}`, { recursive: true });
}
