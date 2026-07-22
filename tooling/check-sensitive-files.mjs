import { readdir } from 'node:fs/promises';
import path from 'node:path';

const ignoredDirectories = new Set(['.git', '.tools', 'node_modules', 'dist', 'coverage']);
const allowedNames = new Set(['.env.example']);
const sensitiveNames = /(^|[._-])(credentials?|secrets?|private[-_]?key)([._-]|$)/i;
const sensitiveExtensions = /\.(db|sqlite|sqlite3|dump|bak|backup|pem|key|p12|pfx)$/i;
const findings = [];

async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await scan(fullPath);
    } else if (
      !allowedNames.has(entry.name) &&
      (entry.name === '.env' || entry.name.startsWith('.env.') || sensitiveNames.test(entry.name) || sensitiveExtensions.test(entry.name))
    ) {
      findings.push(path.relative(process.cwd(), fullPath));
    }
  }
}

await scan(process.cwd());

if (findings.length > 0) {
  console.error('Potentially sensitive files detected:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log('No sensitive filenames were detected.');
}
