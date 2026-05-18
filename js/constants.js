const TILE_SIZE = 32;
const MAP_W = 80;
const MAP_H = 60;

const TILE = { GRASS: 0, TREE: 1, WATER: 2, ROCK: 3 };

const SEASONS = ['Printemps', 'Été', 'Automne', 'Hiver'];
const TICKS_PER_YEAR = 1200;
const TICKS_PER_SEASON = TICKS_PER_YEAR / 4;

const AGE_ADULT = 16;
const AGE_SENIOR = 55;
const AGE_MAX = 72;

const GENDER = { M: 0, F: 1 };

const BDEF = {
  house: {
    name: 'Maison', w: 2, h: 2,
    cost: { wood: 8 },
    color: '#c8784a', roofColor: '#a05530',
    capacity: 4, workers_needed: 0,
    icon: '🏠',
    description: 'Loge 4 habitants.'
  },
  sawmill: {
    name: 'Scierie', w: 3, h: 2,
    cost: { wood: 15 },
    color: '#7a5a18', roofColor: '#5a3e0c',
    workers_needed: 2, job: 'lumberjack',
    produce_interval: 25, produces: { wood: 1 },
    icon: '🪚',
    description: 'Emploie 2 bûcherons. Coupe les arbres proches.'
  },
  farm: {
    name: 'Ferme', w: 3, h: 3,
    cost: { wood: 18 },
    color: '#8ab040', roofColor: '#6a8a20',
    workers_needed: 3, job: 'farmer',
    produce_interval: 35, produces: { food: 3 },
    icon: '🌾',
    description: 'Emploie 3 agriculteurs. Produit de la nourriture.'
  },
  market: {
    name: 'Marché', w: 2, h: 2,
    cost: { wood: 12, gold: 5 },
    color: '#d4b030', roofColor: '#b09010',
    workers_needed: 2, job: 'merchant',
    icon: '🏪',
    description: 'Emploie 2 marchands. Améliore le bonheur (+5).'
  },
  tavern: {
    name: 'Taverne', w: 2, h: 2,
    cost: { wood: 14, gold: 8 },
    color: '#b84830', roofColor: '#902810',
    workers_needed: 2, job: 'tavernkeeper',
    icon: '🍺',
    description: 'Emploie 2 taverniers. Augmente le moral (+10).'
  },
  temple: {
    name: 'Temple', w: 3, h: 3,
    cost: { wood: 25, gold: 15 },
    color: '#b8a0d8', roofColor: '#8870b8',
    workers_needed: 2, job: 'priest',
    icon: '⛪',
    description: 'Emploie 2 prêtres. Apporte la foi.'
  },
  clinic: {
    name: 'Clinique', w: 2, h: 2,
    cost: { wood: 16, gold: 10 },
    color: '#40b880', roofColor: '#208860',
    workers_needed: 2, job: 'doctor',
    icon: '⚕️',
    description: 'Emploie 2 médecins. Soigne les habitants.'
  },
  barracks: {
    name: 'Caserne', w: 3, h: 2,
    cost: { wood: 20, gold: 12 },
    color: '#5878b0', roofColor: '#385890',
    workers_needed: 4, job: 'guard',
    icon: '⚔️',
    description: 'Emploie 4 gardes. Assure la sécurité.'
  },
  tax_office: {
    name: 'Impôts', w: 2, h: 2,
    cost: { wood: 12, gold: 20 },
    color: '#c8a820', roofColor: '#a88000',
    workers_needed: 2, job: 'taxman',
    produce_interval: 80, produces: { gold: 2 },
    icon: '🏛️',
    description: 'Emploie 2 percepteurs. Collecte de l\'or.'
  },
  warehouse: {
    name: 'Entrepôt', w: 2, h: 2,
    cost: { wood: 10 },
    color: '#907860', roofColor: '#705840',
    workers_needed: 1, job: 'storeman',
    icon: '🏗️',
    description: 'Emploie 1 magasinier. Stocke les ressources (+50% capacité).'
  },
};

const JOB_LABELS = {
  lumberjack:   'Bûcheron',
  farmer:       'Agriculteur',
  merchant:     'Marchand',
  tavernkeeper: 'Tavernier',
  priest:       'Prêtre',
  doctor:       'Médecin',
  guard:        'Garde',
  taxman:       'Percepteur',
  storeman:     'Magasinier',
};
