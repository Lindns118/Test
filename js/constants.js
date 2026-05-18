const TILE_SIZE = 32;
const MAP_W = 80;
const MAP_H = 60;

const TILE = { GRASS: 0, PATH: 1, WATER: 2, TREE: 3 };

const TICKS_PER_DAY = 300;
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const BDEF = {
  path: {
    name: 'Chemin', w: 1, h: 1,
    cost: { money: 5 },
    icon: '🛤️',
    isPath: true,
    color: '#c8b890',
    description: 'Trace un chemin pour guider les visiteurs. Maintenez le clic et faites glisser.',
  },
  entrance: {
    name: 'Entrée', w: 4, h: 3,
    cost: { money: 0 },
    icon: '🎪',
    ticket: 15,
    color: '#e0a020', roofColor: '#b07010',
    description: 'Entrée principale du zoo. Unique. Les visiteurs entrent et sortent ici.',
  },
  lion_enclosure: {
    name: 'Enclos Lions', w: 5, h: 5,
    cost: { money: 2000 },
    icon: '🦁',
    isEnclosure: true, animal: 'lion', count: 2,
    popularity: 12, food_day: 30,
    color: '#c89040', fenceColor: '#6a4010',
    description: 'Héberge 2 lions. Très populaire. (pop:12, nourriture:30💵/j)',
  },
  elephant_enclosure: {
    name: 'Enclos Éléphants', w: 6, h: 6,
    cost: { money: 3500 },
    icon: '🐘',
    isEnclosure: true, animal: 'elephant', count: 3,
    popularity: 18, food_day: 50,
    color: '#909898', fenceColor: '#505858',
    description: 'Héberge 3 éléphants. Très grande attraction. (pop:18, nourriture:50💵/j)',
  },
  giraffe_enclosure: {
    name: 'Enclos Girafes', w: 5, h: 6,
    cost: { money: 2800 },
    icon: '🦒',
    isEnclosure: true, animal: 'giraffe', count: 2,
    popularity: 14, food_day: 35,
    color: '#d4b060', fenceColor: '#706020',
    description: 'Héberge 2 girafes. (pop:14, nourriture:35💵/j)',
  },
  penguin_pool: {
    name: 'Bassin Pingouins', w: 4, h: 4,
    cost: { money: 1500 },
    icon: '🐧',
    isEnclosure: true, animal: 'penguin', count: 5,
    popularity: 10, food_day: 20,
    color: '#4a8ab0', fenceColor: '#2a5a80',
    description: 'Héberge 5 pingouins avec piscine. (pop:10, nourriture:20💵/j)',
  },
  monkey_cage: {
    name: 'Cage Singes', w: 4, h: 4,
    cost: { money: 1200 },
    icon: '🐒',
    isEnclosure: true, animal: 'monkey', count: 4,
    popularity: 11, food_day: 18,
    color: '#8a6030', fenceColor: '#4a3010',
    description: 'Héberge 4 singes très actifs. (pop:11, nourriture:18💵/j)',
  },
  zebra_enclosure: {
    name: 'Enclos Zèbres', w: 5, h: 5,
    cost: { money: 2200 },
    icon: '🦓',
    isEnclosure: true, animal: 'zebra', count: 3,
    popularity: 13, food_day: 28,
    color: '#e8e8e0', fenceColor: '#606060',
    description: 'Héberge 3 zèbres. (pop:13, nourriture:28💵/j)',
  },
  bird_aviary: {
    name: 'Volière Oiseaux', w: 5, h: 4,
    cost: { money: 900 },
    icon: '🦜',
    isEnclosure: true, animal: 'bird', count: 6,
    popularity: 7, food_day: 10,
    color: '#60a860', fenceColor: '#307830',
    description: 'Héberge 6 oiseaux colorés. (pop:7, nourriture:10💵/j)',
  },
  restaurant: {
    name: 'Restaurant', w: 3, h: 3,
    cost: { money: 800 },
    icon: '🍽️',
    color: '#c84030', roofColor: '#902010',
    revenue_visitor: 8,
    description: 'Génère 8💵 par visiteur par jour.',
  },
  gift_shop: {
    name: 'Boutique', w: 2, h: 2,
    cost: { money: 500 },
    icon: '🎁',
    color: '#c080c0', roofColor: '#905090',
    revenue_visitor: 5,
    description: 'Génère 5💵 par visiteur par jour.',
  },
  toilets: {
    name: 'Toilettes', w: 2, h: 2,
    cost: { money: 200 },
    icon: '🚻',
    color: '#80b0c0', roofColor: '#508090',
    description: 'Améliore le confort des visiteurs.',
  },
  bench: {
    name: 'Banc', w: 1, h: 1,
    cost: { money: 60 },
    icon: '🪑',
    color: '#a07040',
    isBench: true,
    description: 'Banc pour se reposer. Améliore l\'énergie des visiteurs.',
  },
  keeper_cabin: {
    name: 'Cabane Soigneur', w: 3, h: 2,
    cost: { money: 600 },
    icon: '👷',
    color: '#4a7030', roofColor: '#2a5010',
    wage_day: 30,
    description: 'Soigneur: coûte 30💵/jour. Nécessaire pour les animaux.',
  },
};

const ANIMAL_COLORS = {
  lion:     { body: '#d4902a', mane: '#a06010' },
  elephant: { body: '#808888', ear: '#707078' },
  giraffe:  { body: '#d4b060', spot: '#a07020' },
  penguin:  { body: '#202020', belly: '#f0f0f0' },
  monkey:   { body: '#8a5020', face: '#c07848' },
  bird:     { body: '#40b860', wing: '#f0d020' },
  zebra:    { body: '#e8e8e0', stripe: '#202020' },
};

const GRASS_COLORS = ['#5a8a3c', '#528234', '#4e7a30', '#547e36', '#508038'];

const VISITOR_COLORS = [
  '#e05050', '#50a0e0', '#50c080', '#e0a030',
  '#a050d0', '#e06090', '#40c0c0', '#c0a040',
];
