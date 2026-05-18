class GameMap {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.tiles = [];
    this.generate();
  }

  generate() {
    for (let y = 0; y < this.h; y++) {
      this.tiles[y] = new Uint8Array(this.w);
    }

    const noise = (x, y, s) => {
      let n = Math.sin(x * 127.1 + y * 311.7 + s * 74.3) * 43758.5453;
      return n - Math.floor(n);
    };

    const cx = Math.floor(this.w / 2);
    const cy = Math.floor(this.h / 2);

    // Fill map: mostly grass, trees on borders and scattered
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const distToEdge = Math.min(x, y, this.w - 1 - x, this.h - 1 - y);
        const distToCenter = Math.max(Math.abs(x - cx), Math.abs(y - cy));
        const r = noise(x, y, 3);

        // Border band: dense trees
        if (distToEdge <= 3) {
          if (r > 0.15) this.tiles[y][x] = TILE.TREE;
          continue;
        }

        // Second border ring: medium density
        if (distToEdge <= 6) {
          if (r > 0.45) this.tiles[y][x] = TILE.TREE;
          continue;
        }

        // Central clear zone (20x20): almost no trees
        if (distToCenter < 10) {
          if (r > 0.94) this.tiles[y][x] = TILE.TREE;
          continue;
        }

        // Rest: scattered trees (less dense than border for open zoo feel)
        if (r > 0.78) {
          this.tiles[y][x] = TILE.TREE;
        }
      }
    }

    // Lake 1 (decorative, right side)
    this._addLake(cx + 20, cy - 8, 5, 3);

    // Lake 2 (decorative, left side)
    this._addLake(cx - 22, cy + 14, 4, 3);

    // Ensure entrance zone (top center) is clear
    this._clearArea(cx - 10, 3, 20, 8);

    // Ensure large central area is clear for enclosures
    this._clearArea(cx - 15, cy - 12, 30, 24);
  }

  _addLake(lx, ly, rx, ry) {
    for (let dy = -ry; dy <= ry; dy++) {
      for (let dx = -rx; dx <= rx; dx++) {
        if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) {
          const nx = lx + dx, ny = ly + dy;
          if (this.inBounds(nx, ny)) {
            this.tiles[ny][nx] = TILE.WATER;
          }
        }
      }
    }
  }

  _clearArea(x, y, w, h) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const tx = x + dx, ty = y + dy;
        if (this.inBounds(tx, ty) && this.tiles[ty][tx] !== TILE.WATER) {
          this.tiles[ty][tx] = TILE.GRASS;
        }
      }
    }
  }

  inBounds(x, y) {
    return x >= 0 && x < this.w && y >= 0 && y < this.h;
  }

  getTile(x, y) {
    if (!this.inBounds(x, y)) return TILE.TREE;
    return this.tiles[y][x];
  }

  setTile(x, y, t) {
    if (!this.inBounds(x, y)) return;
    this.tiles[y][x] = t;
  }

  isWalkable(x, y) {
    if (!this.inBounds(x, y)) return false;
    const t = this.tiles[y][x];
    return t !== TILE.WATER && t !== TILE.TREE;
  }

  clearForBuilding(x, y, w, h) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const tx = x + dx, ty = y + dy;
        if (this.inBounds(tx, ty) && this.tiles[ty][tx] !== TILE.WATER) {
          this.tiles[ty][tx] = TILE.GRASS;
        }
      }
    }
  }

  grassVariant(x, y) {
    return ((x * 7 + y * 13) % 5);
  }

  update() {
    // Static map — no regrowth
  }
}
