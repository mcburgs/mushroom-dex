// inject-photos-manual.mjs
// Uses Wikimedia Commons API to resolve thumbnail URLs from known file names
// for the 20 entries that the pageimages API couldn't handle

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, '..', 'data', 'mushrooms.json');

// Known Wikimedia Commons file names for each species
// Sourced from knowledge of common mushroom photos on Wikimedia Commons
const KNOWN_FILES = {
  'blusher':              'Amanita_rubescens_2.jpg',
  'velvet-shank':         'Flammulina_velutipes_LC0251.jpg',
  'blewit':               'Lepista_nuda_LC0192.jpg',
  'wrinkled-peach':       'Rhodotus_palmatus_(cropped).jpg',
  'painted-suillus':      'Suillus_pictus_42399.jpg',
  'scarlet-stemmed-bolete': 'Strobilomyces_betula.jpg',
  'skull-shaped-puffball':'Calvatia_craniiformis_29977.jpg',
  'pigskin-poison-puffball': 'Scleroderma_citrinum_LC0306.jpg',
  'cauliflower-mushroom': 'Sparassis_crispa_cropped.jpg',
  'bay-cup':              'Peziza_badia_51016.jpg',
  'hedgehog-mushroom':    'Hydnum_repandum_LC0310.jpg',
  'shaggy-parasol':       'Chlorophyllum_rhacodes1.jpg',
  'saffron-milk-cap':     'Lactarius_deliciosus_LC0368.jpg',
  'birch-milk-cap':       'Lactarius_tabidus_17866.jpg',
  'deadly-webcap':        'Cortinarius_rubellus.jpg',
  'dapperling':           'Lepiota_cristata_28655.jpg',
  'birch-bolete':         'Leccinum_scabrum_LC0342.jpg',
  'chaga':                'Inonotus_obliquus_chaga.jpg',
  'pear-shaped-puffball': 'Lycoperdon_pyriforme_66419.jpg',
  'birds-nest-fungus':    'Crucibulum_leave_LC0284.jpg',
};

async function fetchCommonsThumb(filename) {
  const encoded = encodeURIComponent(`File:${filename}`);
  const url = `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url&titles=${encoded}&iiurlwidth=800&format=json&origin=*`;

  try {
    const resp = await fetch(url);
    const data = await resp.json();
    const pages = data.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0];
    if (!page || page.missing !== undefined) return null;

    const info = page.imageinfo?.[0];
    if (!info) return null;

    const thumbUrl = info.thumburl;
    const commonsUrl = `https://commons.wikimedia.org/wiki/File:${filename}`;

    return { urlOrLocalPath: thumbUrl, commonsUrl };
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

  for (const [entryId, filename] of Object.entries(KNOWN_FILES)) {
    const idx = mushrooms.findIndex(m => m.id === entryId);
    if (idx === -1) {
      console.log(`  MISS  ${entryId} (not in JSON)`);
      continue;
    }

    process.stdout.write(`  GET   ${entryId} → ${filename}... `);
    const info = await fetchCommonsThumb(filename);

    if (!info) {
      console.log('not found on Commons');
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

    console.log('OK');
    found++;

    await new Promise(r => setTimeout(r, 150));
  }

  console.log(`\nResults: ${found} found, ${missing} not on Commons (will stay as [])`);
  const totalWithImages = mushrooms.filter(m => m.images && m.images.length > 0).length;
  console.log(`Total entries with images: ${totalWithImages} / ${mushrooms.length}`);

  console.log('Writing mushrooms.json...');
  writeFileSync(dataPath, JSON.stringify(mushrooms, null, 2), 'utf8');
  console.log('Done.');
}

main().catch(console.error);
