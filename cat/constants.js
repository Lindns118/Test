const GRAVITY     = 0.55;
const MAX_FALL    = 14;
const TILE_SIZE   = 32; // used only for level ground calculations

// Cat evolution stages
const CAT_STAGES = [
  {
    name: 'Chaton', w: 24, h: 28,
    color: '#f0a844', earColor: '#e08030', bellyColor: '#ffd090',
    speed: 3.0, jumpForce: -12.5, canDash: false, canDoubleJump: false,
    attackRange: 36, attackDmg: 1,
  },
  {
    name: 'Chat', w: 28, h: 32,
    color: '#e07828', earColor: '#c05810', bellyColor: '#ffc070',
    speed: 3.6, jumpForce: -14.0, canDash: true, canDoubleJump: false,
    attackRange: 44, attackDmg: 1,
  },
  {
    name: 'Chat Tigré', w: 32, h: 36,
    color: '#c85010', earColor: '#a03000', bellyColor: '#f0a050',
    speed: 4.2, jumpForce: -15.5, canDash: true, canDoubleJump: true,
    attackRange: 52, attackDmg: 2,
  },
];

// Fish totals needed to evolve
const FISH_THRESHOLDS = [6, 16]; // 6 fish → Chat, 16 fish → Chat Tigré

const COLORS = {
  platform: '#5a3820',
  platformTop: '#7a5838',
  spike: '#c0c0c0',
  exit: '#40e070',
};
