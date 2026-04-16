const fs = require('fs');
const path = require('path');

const lessonsPath = path.join(__dirname, '../data/lessons.json');
const lessons = JSON.parse(fs.readFileSync(lessonsPath, 'utf8'));

function p(url, caption) {
  return { url, caption, credit: 'iNaturalist contributor (CC BY-NC)' };
}

const m = {
  'lesson-001': p('https://inaturalist-open-data.s3.amazonaws.com/photos/93399523/medium.jpeg',  'Shaggy Mane (Coprinus comatus) — a member of Kingdom Fungi, distinct from plants and animals'),
  'lesson-002': p('https://inaturalist-open-data.s3.amazonaws.com/photos/263654604/medium.jpg',  'Phanerodontia chrysosporium — white-rot fungus showing mycelial threads on decaying wood'),
  'lesson-003': p('https://inaturalist-open-data.s3.amazonaws.com/photos/166792593/medium.jpeg', 'Reishi (Ganoderma lucidum) — digests wood externally; cannot photosynthesize like the plants beside it'),
  'lesson-004': p('https://inaturalist-open-data.s3.amazonaws.com/photos/457253795/medium.jpg',  'Meadow Mushroom (Agaricus campestris) — cap, gills, and stem anatomy'),
  'lesson-005': p('https://inaturalist-open-data.s3.amazonaws.com/photos/354358918/medium.jpg',  'King Bolete (Boletus edulis) — spongy pores on the underside instead of gills'),
  'lesson-006': p('https://inaturalist-open-data.s3.amazonaws.com/photos/209263726/medium.jpg',  'Giant Puffball (Calvatia gigantea) — one specimen can release up to 7 trillion spores'),
  'lesson-007': p('https://static.inaturalist.org/photos/200982305/medium.jpg',                  'Mica Cap (Coprinellus micaceus) — its ink-black spore print is a key identification clue'),
  'lesson-008': p('https://inaturalist-open-data.s3.amazonaws.com/photos/119988828/medium.jpg',  'Violet Webcap (Cortinarius violaceus) — a striking autumn species emerging in Ontario woodlands'),
  'lesson-009': p('https://inaturalist-open-data.s3.amazonaws.com/photos/5622972/medium.jpg',    'Bulbous Honey Fungus (Armillaria gallica) — the mycelium beneath this fruiting body may be decades old'),
  'lesson-010': p('https://inaturalist-open-data.s3.amazonaws.com/photos/309948593/medium.jpg',  'Golden Chanterelle (Cantharellus cibarius) — peaks in Ontario during warm wet late-summer conditions'),
  'lesson-011': p('https://inaturalist-open-data.s3.amazonaws.com/photos/106833656/medium.jpg',  'Deadly Webcap (Cortinarius rubellus) — one of many lethal species with no antidote; never eat unconfirmed mushrooms'),
  'lesson-012': p('https://inaturalist-open-data.s3.amazonaws.com/photos/2937852/medium.jpg',    'Fly Agaric (Amanita muscaria) — safe to photograph; toxic to eat; always wash hands after handling'),
  'lesson-013': p('https://inaturalist-open-data.s3.amazonaws.com/photos/4694601/medium.jpg',    'Honey Mushroom (Armillaria ostoyae) — same species as the Humongous Fungus, the largest organism on Earth'),
  'lesson-014': p('https://inaturalist-open-data.s3.amazonaws.com/photos/235753421/medium.jpeg', 'Saffron Milkcap (Lactarius deliciosus) — using all five ID clues together narrows a species confidently'),
  'lesson-015': p('https://static.inaturalist.org/photos/27968797/medium.jpg',                   'Panther Cap (Amanita pantherina) — cap shape, colour, and margin help distinguish this toxic species'),
  'lesson-016': p('https://inaturalist-open-data.s3.amazonaws.com/photos/309948593/medium.jpg',  'Golden Chanterelle (Cantharellus cibarius) — its apricot-like aroma is a key sensory ID clue'),
  'lesson-017': p('https://inaturalist-open-data.s3.amazonaws.com/photos/209263726/medium.jpg',  'Giant Puffball (Calvatia gigantea) — pure white inside when cut; one of the Foolproof Four'),
  'lesson-018': p('https://inaturalist-open-data.s3.amazonaws.com/photos/158303/medium.jpg',     'Destroying Angel (Amanita bisporigera) — pure white and deadly; often mistaken for button mushrooms'),
  'lesson-019': p('https://inaturalist-open-data.s3.amazonaws.com/photos/7839386/medium.jpeg',   'Oyster Mushroom (Pleurotus ostreatus) — its enzymes dissolve the cellulose and lignin in dead wood'),
  'lesson-020': p('https://inaturalist-open-data.s3.amazonaws.com/photos/42106925/medium.jpg',   'Chicken of the Woods (Laetiporus sulphureus) — chitin in its cell walls gives it a firm texture'),
  'lesson-021': p('https://inaturalist-open-data.s3.amazonaws.com/photos/435797142/medium.jpeg', 'Jack-O-Lantern (Omphalotus olearius) — gills emit a faint green glow in complete darkness'),
  'lesson-022': p('https://inaturalist-open-data.s3.amazonaws.com/photos/2340175/medium.jpg',    'Giant Polypore (Meripilus giganteus) — a saprotrophic fungus decomposing a dead hardwood stump'),
  'lesson-023': p('https://inaturalist-open-data.s3.amazonaws.com/photos/12823339/medium.jpeg',  'Slippery Jack (Suillus luteus) — forms close mycorrhizal partnerships with pine tree roots'),
  'lesson-024': p('https://inaturalist-open-data.s3.amazonaws.com/photos/78612146/medium.jpeg',  'Laccaria bicolor — a key mycorrhizal species studied in Wood Wide Web network research'),
  'lesson-025': p('https://inaturalist-open-data.s3.amazonaws.com/photos/440636205/medium.jpeg', 'Parasol Mushroom (Macrolepiota procera) — a classic field find that benefits from a full forager kit'),
  'lesson-026': p('https://inaturalist-open-data.s3.amazonaws.com/photos/273233405/medium.jpeg', 'Black Morel (Morchella elata) — every find deserves a journal entry: date, habitat, and sketch'),
  'lesson-027': p('https://static.inaturalist.org/photos/351794616/medium.jpg',                  'Common Button Mushroom (Agaricus bisporus) — a classic basidiomycete showing the fruiting body plan'),
  'lesson-028': p('https://inaturalist-open-data.s3.amazonaws.com/photos/111494893/medium.jpg',  'Fly Agaric (Amanita muscaria) — binomial name coined by Linnaeus in 1753; genus + species epithet'),
  'lesson-029': p('https://inaturalist-open-data.s3.amazonaws.com/photos/111266235/medium.jpg',  'Death Cap (Amanita phalloides) — ring, cap, and swollen base volva define genus Amanita'),
  'lesson-030': p('https://inaturalist-open-data.s3.amazonaws.com/photos/27005174/medium.jpg',   'Turkey Tail (Trametes versicolor) — bracket polypore with concentric colour bands on an Ontario log'),
  'lesson-031': p('https://inaturalist-open-data.s3.amazonaws.com/photos/237728653/medium.jpg',  'Common Puffball (Lycoperdon perlatum) — when compressed it shoots a jet of spores into the air'),
  'lesson-032': p('https://inaturalist-open-data.s3.amazonaws.com/photos/7839386/medium.jpeg',   'Oyster Mushroom (Pleurotus ostreatus) — a dense cluster cascading from a dead Ontario hardwood log'),
  'lesson-033': p('https://inaturalist-open-data.s3.amazonaws.com/photos/10028/medium.jpg',      'Honey Mushroom (Armillaria mellea) — a parasitic cluster spreading from an infected tree base'),
  'lesson-034': p('https://inaturalist-open-data.s3.amazonaws.com/photos/348507061/medium.jpeg', 'Tree Lungwort (Lobaria pulmonaria) — a foliose lichen whose presence signals clean air'),
  'lesson-035': p('https://inaturalist-open-data.s3.amazonaws.com/photos/194781537/medium.jpg',  'Yellow Morel (Morchella esculenta) — fruits explosively in Ontario the spring after a forest fire'),
  'lesson-036': p('https://static.inaturalist.org/photos/12031453/medium.jpg',                   "Lion's Mane (Hericium erinaceus) — a rare Carolinian species found in Ontario mixed hardwood forests"),
  'lesson-037': p('https://inaturalist-open-data.s3.amazonaws.com/photos/8883146/medium.png',    'White-pored Chicken of the Woods (Laetiporus cincinnatus) — a Carolinian species in the Grand River valley'),
  'lesson-038': p('https://inaturalist-open-data.s3.amazonaws.com/photos/309948593/medium.jpg',  'Golden Chanterelle (Cantharellus cibarius) — July is peak season in Southern Ontario woodlands'),
  'lesson-039': p('https://inaturalist-open-data.s3.amazonaws.com/photos/109349419/medium.jpg',  'The Sickener (Russula emetica) — many Russula species require microscopy for confident ID'),
  'lesson-040': p('https://inaturalist-open-data.s3.amazonaws.com/photos/244672547/medium.jpg',  'Summer Bolete (Boletus reticulatus) — the kind of specimen you key out step-by-step in a field guide'),
  'lesson-041': p('https://inaturalist-open-data.s3.amazonaws.com/photos/27005174/medium.jpg',   'Turkey Tail (Trametes versicolor) — PSK compounds from this fungus are in active clinical research'),
  'lesson-042': p('https://inaturalist-open-data.s3.amazonaws.com/photos/29410378/medium.jpeg',  'King Trumpet (Pleurotus eryngii) — Pleurotus species are frontline candidates in mycoremediation'),
  'lesson-043': p('https://inaturalist-open-data.s3.amazonaws.com/photos/87978650/medium.jpeg',  "Artist's Bracket (Ganoderma applanatum) — the same dense mycelium can be grown into packaging foam"),
  'lesson-044': p('https://static.inaturalist.org/photos/321579714/medium.jpeg',                  'Pisolithus arhizus (Dyeball) — a mycorrhizal truffle-like fungus that stores carbon deep in soil'),
  'lesson-045': p('https://inaturalist-open-data.s3.amazonaws.com/photos/540330050/medium.jpg',  'Golden Chanterelle (Cantharellus cibarius) — a well-photographed find makes a high-quality iNaturalist observation'),
  'lesson-046': p('https://inaturalist-open-data.s3.amazonaws.com/photos/457253795/medium.jpg',  'Meadow Mushroom (Agaricus campestris) — an ethical foray find worth documenting and leaving in place'),
  'lesson-047': p('https://inaturalist-open-data.s3.amazonaws.com/photos/87978650/medium.jpeg',  "Artist's Bracket (Ganoderma applanatum) — an old-growth specialist that takes decades to establish"),
  'lesson-048': p('https://inaturalist-open-data.s3.amazonaws.com/photos/11787994/medium.jpeg',  'Hoof Fungus (Fomes fomentarius) — lives 40+ years; only on trees old enough for deep heartwood decay'),
  'lesson-049': p('https://static.inaturalist.org/photos/576898/medium.jpg',                     "Bear's Head Tooth (Hericium americanum) — an excellent focus species for a personal research project"),
  'lesson-050': p('https://inaturalist-open-data.s3.amazonaws.com/photos/194781537/medium.jpg',  'Yellow Morel (Morchella esculenta) — every field season brings new discoveries for a trained mycologist'),
};

let changed = 0;
lessons.forEach(l => {
  if (m[l.id]) { l.images = [m[l.id]]; changed++; }
});

fs.writeFileSync(lessonsPath, JSON.stringify(lessons, null, 2));
console.log('Updated', changed, 'of', lessons.length, 'lessons.');
