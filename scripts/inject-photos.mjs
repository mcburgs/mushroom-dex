// inject-photos.mjs
// Fetches Wikimedia Commons hero images via Wikipedia pageimages API
// and injects them into data/mushrooms.json for all entries with images: []

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, '..', 'data', 'mushrooms.json');

// Map mushroom entry ID → Wikipedia article title (English)
// Entries marked null will be skipped (no good article / wrong image risk)
const WIKI_TITLES = {
  'fly-agaric': 'Amanita muscaria',
  'destroying-angel': 'Amanita bisporigera',
  'death-cap': 'Amanita phalloides',
  'blusher': 'Amanita rubescens',
  'panther-cap': 'Amanita pantherina',
  'jack-o-lantern': 'Omphalotus illudens',
  'shaggy-mane': 'Coprinus comatus',
  'honey-mushroom': 'Armillaria mellea',
  'velvet-shank': 'Flammulina velutipes',
  'inky-cap': 'Coprinellus micaceus',
  'wine-cap': 'Stropharia rugosoannulata',
  'meadow-mushroom': 'Agaricus campestris',
  'indigo-milk-cap': 'Lactarius indigo',
  'lobster-mushroom': 'Hypomyces lactifluorum',
  'blewit': 'Lepista nuda',
  'velvet-roll-rim': 'Tapinella atrotomentosa',
  'orange-mock-oyster': 'Phyllotopsis nidulans',
  'bleeding-mycena': 'Mycena haematopus',
  'witchs-hat': 'Hygrocybe conica',
  'wrinkled-peach': 'Rhodotus palmatus',
  'king-bolete': 'Boletus edulis',
  'bay-bolete': 'Imleria badia',
  'two-colored-bolete': 'Baorangia bicolor',
  'painted-suillus': 'Suillus pictus',
  'slippery-jack': 'Suillus luteus',
  'old-man-of-the-woods': 'Strobilomyces strobilaceus',
  'scarlet-stemmed-bolete': 'Heimioporus betula',
  'butter-bolete': 'Butyriboletus appendiculatus',
  'hen-of-the-woods': 'Grifola frondosa',
  'dryads-saddle': 'Cerioporus squamosus',
  'birch-polypore': 'Fomitopsis betulina',
  'red-belted-polypore': 'Fomitopsis pinicola',
  'reishi': 'Ganoderma tsugae',
  'cinnabar-polypore': 'Pycnoporus cinnabarinus',
  'skull-shaped-puffball': 'Calvatia craniiformis',
  'pigskin-poison-puffball': 'Scleroderma citrinum',
  'crowned-coral': 'Artomyces pyxidatus',
  'cauliflower-mushroom': 'Sparassis americana',
  'violet-tipped-coral': null, // No reliable article for Ramaria fumigata
  'golden-coral': 'Ramaria aurea',
  'witchs-butter': 'Tremella mesenterica',
  'wood-ear': 'Auricularia auricula-judae', // broader article has best image
  'brown-witchs-butter': 'Exidia glandulosa',
  'orange-peel-fungus': 'Aleuria aurantia',
  'scarlet-cup': 'Sarcoscypha austriaca',
  'bay-cup': 'Peziza badia',
  'lions-mane': 'Hericium erinaceus',
  'bears-head-tooth': 'Hericium americanum',
  'hedgehog-mushroom': 'Hydnum repandum',
  'yellow-morel': 'Morchella americana',
  'black-morel': 'Morchella importuna',
  'false-morel': 'Gyromitra esculenta',
  'common-stinkhorn': 'Phallus impudicus',
  'dog-stinkhorn': 'Mutinus caninus',
  'hairy-curtain-crust': 'Stereum hirsutum',
  'bleeding-broadleaf-crust': null, // Byssomerulius corium — limited article
  'dead-mans-fingers': 'Xylaria polymorpha',
  'candlesnuff': 'Xylaria hypoxylon',
  'earthstar': 'Geastrum saccatum',
  'splitgill': 'Schizophyllum commune',
  'funnel-chanterelle': 'Craterellus tubaeformis',
  'conifer-tuft': 'Hypholoma capnoides',
  'galerina-marginata': 'Galerina marginata',
  'sulphur-tuft': 'Hypholoma fasciculare',
  'false-chanterelle': 'Hygrophoropsis aurantiaca',
  'green-spored-parasol': 'Chlorophyllum molybdites',
  'shaggy-parasol': 'Chlorophyllum rhacodes',
  'yellow-stainer': 'Agaricus xanthodermus',
  'horse-mushroom': 'Agaricus arvensis',
  'amethyst-deceiver': 'Laccaria amethystina',
  'common-deceiver': 'Laccaria laccata',
  'sickener': 'Russula emetica',
  'green-cracking-russula': 'Russula virescens',
  'crab-brittlegill': 'Russula xerampelina',
  'saffron-milk-cap': 'Lactarius deliciosus',
  'birch-milk-cap': 'Lactarius tabidus',
  'scaly-pholiota': 'Pholiota squarrosa',
  'deadly-webcap': 'Cortinarius rubellus',
  'violet-webcap': 'Cortinarius violaceus',
  'dapperling': 'Lepiota cristata',
  'birch-bolete': 'Leccinum scabrum',
  'orange-birch-bolete': 'Leccinum versipelle',
  'bitter-bolete': 'Tylopilus felleus',
  'beefsteak-fungus': 'Fistulina hepatica',
  'tinder-polypore': 'Fomes fomentarius',
  'chaga': 'Inonotus obliquus',
  'pear-shaped-puffball': 'Lycoperdon pyriforme',
  'pigs-ear': 'Gomphus clavatus',
  'purple-fairy-club': 'Clavaria zollingeri',
  'jelly-baby': 'Leotia lubrica',
  'birds-nest-fungus': 'Crucibulum laeve',
  'elf-saddle': 'Helvella lacunosa',
  'devils-urn': 'Urnula craterium',
};

async function fetchImageInfo(wikiTitle) {
  const encoded = encodeURIComponent(wikiTitle);
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=pageimages&format=json&pithumbsize=800&pilicense=any`;

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

    // Extract the Commons file name from the thumb URL
    // Format: /wikipedia/commons/thumb/X/XX/Filename.ext/800px-Filename.ext
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

  const needsImages = mushrooms.filter(m => !m.images || m.images.length === 0);
  console.log(`Entries needing images: ${needsImages.length}`);

  let injected = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of needsImages) {
    const wikiTitle = WIKI_TITLES[entry.id];

    if (wikiTitle === null) {
      console.log(`  SKIP  ${entry.id} (intentionally excluded)`);
      skipped++;
      continue;
    }

    if (wikiTitle === undefined) {
      console.log(`  MISS  ${entry.id} (no mapping)`);
      failed++;
      continue;
    }

    process.stdout.write(`  GET   ${entry.id} (${wikiTitle})... `);
    const info = await fetchImageInfo(wikiTitle);

    if (!info) {
      console.log('no image found');
      failed++;
      continue;
    }

    // Build image asset object
    const imageAsset = {
      id: `${entry.id}-hero`,
      mushroomEntryId: entry.id,
      urlOrLocalPath: info.urlOrLocalPath,
      caption: '',
      sourceName: 'Wikimedia Commons',
      sourceUrl: info.commonsUrl,
      attribution: 'Wikimedia Commons / CC BY-SA',
      notes: '',
      isHero: true,
    };

    // Find and update the entry in the array
    const idx = mushrooms.findIndex(m => m.id === entry.id);
    mushrooms[idx].images = [imageAsset];

    console.log(`OK → ${info.commonsFile}`);
    injected++;

    // Small delay to be polite to Wikipedia's API
    await new Promise(r => setTimeout(r, 150));
  }

  console.log(`\nResults: ${injected} injected, ${skipped} skipped, ${failed} failed`);

  console.log('Writing mushrooms.json...');
  writeFileSync(dataPath, JSON.stringify(mushrooms, null, 2), 'utf8');
  console.log('Done.');
}

main().catch(console.error);
