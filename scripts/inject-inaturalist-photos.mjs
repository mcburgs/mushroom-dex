// inject-inaturalist-photos.mjs
// Fetches iNaturalist taxon default photos by scientific name search.
// Photos served from S3 — no rate limiting, no hotlink protection.

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, '..', 'data', 'mushrooms.json');

async function fetchByName(scientificName) {
  const encoded = encodeURIComponent(scientificName);
  const url = `https://api.inaturalist.org/v1/taxa?q=${encoded}&per_page=1&rank=species,genus`;
  try {
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) return null;
    const data = await resp.json();
    const taxon = data.results?.[0];
    if (!taxon?.default_photo?.medium_url) return null;
    return {
      photoUrl: taxon.default_photo.medium_url,
      attribution: taxon.default_photo.attribution ?? 'iNaturalist / CC BY-NC',
      sourceUrl: `https://www.inaturalist.org/taxa/${taxon.id}`,
      taxonName: taxon.name,
    };
  } catch (e) {
    return null;
  }
}

async function main() {
  const mushrooms = JSON.parse(readFileSync(dataPath, 'utf8'));
  let found = 0, failed = 0;

  for (const entry of mushrooms) {
    process.stdout.write(`  ${entry.id} (${entry.scientificName})... `);
    const info = await fetchByName(entry.scientificName);

    if (!info) {
      console.log('no result');
      failed++;
      continue;
    }

    mushrooms[mushrooms.findIndex(m => m.id === entry.id)].images = [{
      id: `${entry.id}-hero`,
      mushroomEntryId: entry.id,
      urlOrLocalPath: info.photoUrl,
      caption: '',
      sourceName: 'iNaturalist',
      sourceUrl: info.sourceUrl,
      attribution: info.attribution,
      notes: '',
      isHero: true,
    }];

    console.log(`OK [${info.taxonName}] → ${info.photoUrl.slice(0, 55)}...`);
    found++;
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\nDone: ${found} found, ${failed} failed`);
  writeFileSync(dataPath, JSON.stringify(mushrooms, null, 2));
  console.log('Written.');
}

main().catch(console.error);
