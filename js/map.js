class GameMap {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.tiles = [];
    this.treeHealth = [];
    this.treeRegrow = [];
    this.generate();
  }

  generate() {
    for (let y = 0; y < this.h; y++) {
      this.tiles[y] = new Uint8Array(this.w);
      this.treeHealth[y] = new Uint8Array(this.w);
      this.treeRegrow[y] = new Uint16Array(this.w);
    }

    // Seeded pseudo-random for deterministic map
    const noise = (x, y, s) => {
      let n = Math.sin(x * 127.1 + y * 311.7 + s * 74.3) * 43758.5453;
      return n - Math.floor(n);
    };

    const cx = Math.floor(this.w / 2);
    const cy = Math.floor(this.h / 2);

    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const distToCenter = Math.max(Math.abs(x - cx), Math.abs(y - cy));
        const r = noise(x, y, 1);
        const r2 = noise(x, y, 2);

        if (distToCenter < 10) {
          // Keep central area mostly clear
          if (r > 0.9) {
            this.tiles[y][x] = TILE.TREE;
            this.treeHealth[y][x] = 3;
          }
        } else {
          if (r > 0.62) {
            this.tiles[y][x] = TILE.TREE;
            this.treeHealth[y][x] = 3;
          } else if (r < 0.03) {
            this.tiles[y][x] = TILE.ROCK;
          }
        }
      }
    }

    // Lake
    const lx = cx + 18, ly = cy - 10;
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -6; dx <= 6; dx++) {
        if (dx*dx/36 + dy*dy/16 <= 1) {
          const nx = lx + dx, ny = ly + dy;
          if (this.inBounds(nx, ny)) {
            this.tiles[ny][nx] = TILE.WATER;
            this.treeHealth[ny][nx] = 0;
          }
        }
      }
    }

    // Second smaller lake
    const lx2 = cx - 22, ly2 = cy + 12;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        if (dx*dx/16 + dy*dy/9 <= 1) {
          const nx = lx2 + dx, ny = ly2 + dy;
          if (this.inBounds(nx, ny)) {
            this.tiles[ny][nx] = TILE.WATER;
            this.treeHealth[ny][nx] = 0;
          }
        }
      }
    }
  }

  inBounds(x, y) {
    return x >= 0 && x < this.w && y >= 0 && y < this.h;
  }

  getTile(x, y) {
    if (!this.inBounds(x, y)) return TILE.ROCK;
    return this.tiles[y][x];
  }

  isWalkable(x, y) {
    if (!this.inBounds(x, y)) return false;
    const t = this.tiles[y][x];
    return t !== TILE.WATER && t !== TILE.ROCK;
  }

  isTree(x, y) {
    if (!this.inBounds(x, y)) return false;
    return this.tiles[y][x] === TILE.TREE && this.treeHealth[y][x] > 0;
  }

  cutTree(x, y) {
    if (!this.isTree(x, y)) return 0;
    this.tiles[y][x] = TILE.GRASS;
    this.treeHealth[y][x] = 0;
    this.treeRegrow[y][x] = 500 + Math.floor(Math.random() * 300);
    return 1;
  }

  clearArea(x, y, w, h) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const tx = x + dx, ty = y + dy;
        if (this.inBounds(tx, ty) && this.tiles[ty][tx] !== TILE.WATER) {
          this.tiles[ty][tx] = TILE.GRASS;
          this.treeHealth[ty][tx] = 0;
          this.treeRegrow[ty][tx] = 0;
        }
      }
    }
  }

  update() {
    // Sample a chunk each tick to spread regrowth processing
    const chunkSize = 16;
    const startX = Math.floor(Math.random() * (this.w - chunkSize));
    const startY = Math.floor(Math.random() * (this.h - chunkSize));

    for (let y = startY; y < startY + chunkSize; y++) {
      for (let x = startX; x < startX + chunkSize; x++) {
        if (this.treeRegrow[y][x] > 0) {
          this.treeRegrow[y][x]--;
          if (this.treeRegrow[y][x] === 0) {
            this.tiles[y][x] = TILE.TREE;
            this.treeHealth[y][x] = 3;
          }
        }
      }
    }
  }

  grassVariant(x, y) {
    return ((x * 7 + y * 13) % 5);
  }
}

const GRASS_COLORS = ['#5a8a3c', '#528234', '#4e7a30', '#547e36', '#508038'];
