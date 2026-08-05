// Filters ESLint inputs so it only receives files it will actually lint.
// Prevents "File ignored" warnings from failing --max-warnings 0.
const path = require('node:path');

const isEslintable = (file) => {
  const base = path.basename(file);
  if (file.endsWith('.d.ts')) return false;
  if (base.startsWith('.')) return false;
  const rel = path.relative(__dirname, file).split(path.sep).join('/');
  if (rel.startsWith('frontend/')) return false;
  if (rel.startsWith('dist/') || rel.includes('/dist/')) return false;
  if (rel.startsWith('build/') || rel.includes('/build/')) return false;
  if (rel.startsWith('coverage/') || rel.includes('/coverage/')) return false;
  if (rel.includes('prisma/migrations/')) return false;
  return true;
};

const quote = (f) => `"${f}"`;

module.exports = {
  '*.{ts,tsx,js,cjs,mjs}': (files) => {
    const commands = [`prettier --write ${files.map(quote).join(' ')}`];
    const lintable = files.filter(isEslintable);
    if (lintable.length) {
      commands.push(`eslint --fix --max-warnings 0 ${lintable.map(quote).join(' ')}`);
    }
    return commands;
  },
  '*.{json,md,yml,yaml,css}': (files) => [`prettier --write ${files.map(quote).join(' ')}`],
};
