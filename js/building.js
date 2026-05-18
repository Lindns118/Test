let _buildingId = 0;

class Building {
  constructor(type, x, y) {
    this.id = _buildingId++;
    this.type = type;
    this.x = x;
    this.y = y;
    this.def = BDEF[type];
    this.w = this.def.w;
    this.h = this.def.h;

    // For enclosures: list of Animal objects
    this.animals = [];
  }

  occupies(x, y) {
    return x >= this.x && x < this.x + this.w &&
           y >= this.y && y < this.y + this.h;
  }

  get centerPx() {
    return {
      x: (this.x + this.w / 2) * TILE_SIZE,
      y: (this.y + this.h / 2) * TILE_SIZE,
    };
  }

  // Tile just below the building center (entry point for visitors)
  get entryTile() {
    return {
      x: this.x + Math.floor(this.w / 2),
      y: this.y + this.h,
    };
  }

  // For entrance: tile just below the building (exit for visitors going out)
  get entranceTile() {
    return {
      x: this.x + Math.floor(this.w / 2),
      y: this.y + this.h,
    };
  }

  spawnAnimals(game) {
    if (!this.def.isEnclosure) return;
    this.animals = [];
    for (let i = 0; i < this.def.count; i++) {
      const a = new Animal(this.def.animal, this);
      this.animals.push(a);
      game.animals.push(a);
    }
  }

  update(game) {
    // Building-level logic (currently handled at game level)
  }
}
