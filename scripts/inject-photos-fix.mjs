// inject-photos-fix.mjs
// Fixes horse-mushroom (wrong image) and retries 20 failed entries
// with alternative Wikipedia article titles

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, '..', 'data', 'mushrooms.json');

// Alternative titles for the 20 that failed + horse-mushroom fix
// null = clear image (wrong/risky image), false = skip retry
const RETRY_TITLES = {
  'blusher': 'Amanita rubescens',           // try again with prop=pageimages|images
  'velvet-shank': 'Enoki (mushroom)',
  'blewit': 'Wood blewit',
  'wrinkled-peach': 'Rhodotus palmatus',
  'painted-suillus': 'Suillus pictus',
  'scarlet-stemmed-bolete': 'Heimioporus betula',
  'skull-shaped-puffball': 'Calvatia craniiformis',
  'pigskin-poison-puffball': 'Scleroderma citrinum',
  'cauliflower-mushroom': 'Sparassis americana',
  'bay-cup': 'Peziza badia',
  'hedgehog-mushroom': 'Hydnum repandum',
  'shaggy-parasol': 'Chlorophyllum rhacodes',
  'saffron-milk-cap': 'Lactarius deliciosus',
  'birch-milk-cap': 'Lactarius tabidus',
  'deadly-webcap': 'Cortinarius rubellus',
  'dapperling': 'Lepiota cristata',
  'birch-bolete': 'Leccinum scabrum',
  'chaga': 'Chaga mushroom',
  'pear-shaped-puffball': 'Lycoperdon pyriforme',
  'birds-nest-fungus': 'Crucibulum laeve',
  // Fix: horse-mushroom got a Agaricus campestris image — clear it
  'horse-mushroom': null,
};

async function fetchImageInfo(wikiTitle) {
  // Try prop=pageimages without license filter first
  const encoded = encodeURIComponent(wikiTitle);
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=pageimages&format=json&pithumbsize=800`;

  try {
    const resp = await fetch(url);
    const data = await resp.json();
    const pages = data.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0];
    if (!page || page.missing !== undefined) return null;

    const thumbnail = page.thumbnail;
    if (!thumbnail) return null;

    const thumbUrl = thumbnail.source;
    const match = thumbUrl.match(/\/commons\/thumb\/[^/]+\/[^/]+\/([^/]+)\//);
    if (!match) return null;

    const filename = match[1];
    const commonsFileUrl = `https://commons.wikimedia.org/wiki/File:${filename}`;

    return {
      urlOrLocalPath: thumbUrl.replace(/\/\d+px-/, '/800px-'),
      commonsFile: filename,
      commonsUrl: commonsFileUrl,
    };
  } catch (e) {
    console.error(`  Error fetching ${wikiTitle}: ${e.message}`);
    return null;
  }
}

async function main() {
  console.log('Loading mushrooms.json...');
  const mushrooms = JSON.parse(readFileSync(dataPath, 'utf8'));

  let fixed = 0;
  let found = 0;
  let stillMissing = 0;

  for (const [entryId, wikiTitle] of Object.entries(RETRY_TITLES)) {
    const idx = mushrooms.findIndex(m => m.id === entryId);
    if (idx === -1) {
      console.log(`  MISS  ${entryId} (not in JSON!)`);
      continue;
    }

    // null = clear wrong image
    if (wikiTitle === null) {
      console.log(`  CLEAR ${entryId} (removing wrong image)`);
      mushrooms[idx].images = [];
      fixed++;
      continue;
    }

    process.stdout.write(`  GET   ${entryId} (${wikiTitle})... `);
    const info = await fetchImageInfo(wikiTitle);

    if (!info) {
      console.log('still no image');
      stillMissing++;
      continue;
    }

    const imageAsset = {
      id: `${entryId}-hero`,
      mushroomEntryId: entryId,
      urlOrLocalPath: info.urlOrLocalPath,
      caption: '',
      sourceName: 'Wikimedia Commons',
      sourceUrl: info.commonsUrl,
      attribution: 'Wikimedia Commons / CC BY-SA',
      notes: '',
      isHero: true,
    };

    mushrooms[idx].images = [imageAsset];
    console.log(`OK → ${info.commonsFile}`);
    found++;

    await new Promise(r => setTimeout(r, 150));
  }

  console.log(`\nResults: ${found} newly found, ${fixed} cleared, ${stillMissing} still missing`);

  const totalWithImages = mushrooms.filter(m => m.images && m.images.length > 0).length;
  console.log(`Total entries with images: ${totalWithImages} / ${mushrooms.length}`);

  console.log('Writing mushrooms.json...');
  writeFileSync(dataPath, JSON.stringify(mushrooms, null, 2), 'utf8');
  console.log('Done.');
}

main().catch(console.error);
