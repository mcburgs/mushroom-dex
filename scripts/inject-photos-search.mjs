// inject-photos-search.mjs
// Uses Wikimedia Commons search API to find images for remaining 19 entries

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, '..', 'data', 'mushrooms.json');

// Scientific names to search for
const SEARCH_TERMS = {
  'velvet-shank':           'Flammulina velutipes',
  'blewit':                 'Lepista nuda',
  'wrinkled-peach':         'Rhodotus palmatus',
  'painted-suillus':        'Suillus pictus',
  'scarlet-stemmed-bolete': 'Heimioporus betula',
  'skull-shaped-puffball':  'Calvatia craniiformis',
  'pigskin-poison-puffball':'Scleroderma citrinum',
  'cauliflower-mushroom':   'Sparassis crispa',      // use crispa instead of americana
  'bay-cup':                'Peziza badia',
  'hedgehog-mushroom':      'Hydnum repandum',
  'shaggy-parasol':         'Chlorophyllum rhacodes',
  'saffron-milk-cap':       'Lactarius deliciosus',
  'birch-milk-cap':         'Lactarius tabidus',
  'deadly-webcap':          'Cortinarius rubellus',
  'dapperling':             'Lepiota cristata',
  'birch-bolete':           'Leccinum scabrum',
  'chaga':                  'Inonotus obliquus',
  'pear-shaped-puffball':   'Lycoperdon pyriforme',
  'birds-nest-fungus':      'Crucibulum laeve',
};

async function searchCommonsImage(searchTerm) {
  // Use Commons API to search for files by the scientific name
  const encoded = encodeURIComponent(searchTerm);
  const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&srnamespace=6&srlimit=5&format=json&origin=*`;

  try {
    const resp = await fetch(url);
    const data = await resp.json();
    const results = data.query?.search;
    if (!results || results.length === 0) return null;

    // Take the first result, strip "File:" prefix
    const title = results[0].title; // e.g. "File:Hydnum_repandum.jpg"
    if (!title.startsWith('File:')) return null;

    const filename = title.slice(5); // strip "File:"

    // Now get the thumb URL for this file
    const fileEncoded = encodeURIComponent(title);
    const thumbUrl2 = `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url&titles=${fileEncoded}&iiurlwidth=800&format=json&origin=*`;

    const resp2 = await fetch(thumbUrl2);
    const data2 = await resp2.json();
    const pages = data2.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0];
    if (!page || page.missing !== undefined) return null;

    const info = page.imageinfo?.[0];
    if (!info?.thumburl) return null;

    return {
      filename,
      urlOrLocalPath: info.thumburl,
      commonsUrl: `https://commons.wikimedia.org/wiki/File:${filename}`,
    };
  } catch (e) {
    console.error(`  Error: ${e.message}`);
    return null;
  }
}

async function main() {
  console.log('Loading mushrooms.json...');
  const mushrooms = JSON.parse(readFileSync(dataPath, 'utf8'));

  let found = 0;
  let missing = 0;

  for (const [entryId, searchTerm] of Object.entries(SEARCH_TERMS)) {
    const idx = mushrooms.findIndex(m => m.id === entryId);
    if (idx === -1) continue;

    // Skip if already has image
    if (mushrooms[idx].images && mushrooms[idx].images.length > 0) {
      console.log(`  SKIP  ${entryId} (already has image)`);
      continue;
    }

    process.stdout.write(`  SRCH  ${entryId} ("${searchTerm}")... `);
    const info = await searchCommonsImage(searchTerm);

    if (!info) {
      console.log('no result');
      missing++;
      continue;
    }

    mushrooms[idx].images = [{
      id: `${entryId}-hero`,
      mushroomEntryId: entryId,
      urlOrLocalPath: info.urlOrLocalPath,
      caption: '',
      sourceName: 'Wikimedia Commons',
      sourceUrl: info.commonsUrl,
      attribution: 'Wikimedia Commons / CC BY-SA',
      notes: '',
      isHero: true,
    }];

    console.log(`OK → ${info.filename}`);
    found++;

    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\nResults: ${found} found, ${missing} still missing`);
  const totalWithImages = mushrooms.filter(m => m.images && m.images.length > 0).length;
  console.log(`Total entries with images: ${totalWithImages} / ${mushrooms.length}`);

  console.log('Writing mushrooms.json...');
  writeFileSync(dataPath, JSON.stringify(mushrooms, null, 2), 'utf8');
  console.log('Done.');
}

main().catch(console.error);
