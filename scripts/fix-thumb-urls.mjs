// fix-thumb-urls.mjs
// Converts Wikimedia /thumb/ URLs to original file URLs, which bypass
// the thumbnail renderer and are always accessible.
//
// thumb:    /wikipedia/commons/thumb/X/XX/File.jpg/800px-File.jpg
// original: /wikipedia/commons/X/XX/File.jpg

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, '..', 'data', 'mushrooms.json');

function thumbToOriginal(url) {
  // Match Wikimedia thumb pattern
  const match = url.match(
    /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/)thumb\/([^/]+\/[^/]+\/)([^/]+)\/\d+px-[^/]+$/
  );
  if (!match) return url; // not a thumb URL — leave as-is
  return `${match[1]}${match[2]}${match[3]}`;
}

const mushrooms = JSON.parse(readFileSync(dataPath, 'utf8'));

let converted = 0;
let alreadyOriginal = 0;
let noImage = 0;

for (const entry of mushrooms) {
  if (!entry.images || entry.images.length === 0) {
    noImage++;
    continue;
  }
  for (const img of entry.images) {
    const original = thumbToOriginal(img.urlOrLocalPath);
    if (original !== img.urlOrLocalPath) {
      console.log(`  CONV  ${entry.id}`);
      console.log(`        ${img.urlOrLocalPath}`);
      console.log(`     -> ${original}`);
      img.urlOrLocalPath = original;
      converted++;
    } else {
      alreadyOriginal++;
    }
  }
}

console.log(`\nConverted: ${converted} | Already original: ${alreadyOriginal} | No image: ${noImage}`);
writeFileSync(dataPath, JSON.stringify(mushrooms, null, 2));
console.log('Written.');
