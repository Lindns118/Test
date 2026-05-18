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
    this.workers = [];
    this.residents = [];
    this.active = false;
    this.produceTimer = 0;
    this.searchRadius = type === 'sawmill' ? 10 : 0;
  }

  get needsWorkers() { return this.workers.length < this.def.workers_needed; }
  get isHouse() { return this.type === 'house'; }
  get workerRatio() {
    if (this.def.workers_needed === 0) return 1;
    return this.workers.length / this.def.workers_needed;
  }

  get entryTile() {
    return {
      x: this.x + Math.floor(this.w / 2),
      y: this.y + this.h,
    };
  }

  get centerPx() {
    return {
      x: (this.x + this.w / 2) * TILE_SIZE,
      y: (this.y + this.h / 2) * TILE_SIZE,
    };
  }

  occupies(x, y) {
    return x >= this.x && x < this.x + this.w &&
           y >= this.y && y < this.y + this.h;
  }

  update(game) {
    this.active = this.def.workers_needed === 0 || this.workers.length >= 1;

    if (!this.active || !this.def.produces) return;

    this.produceTimer++;
    const interval = Math.ceil(this.def.produce_interval / Math.max(0.1, this.workerRatio));
    if (this.produceTimer < interval) return;
    this.produceTimer = 0;

    for (const [res, amt] of Object.entries(this.def.produces)) {
      game.resources[res] = (game.resources[res] || 0) + amt * this.workerRatio;
    }

    if (this.type === 'sawmill') {
      this._harvestNearbyTree(game);
    }
  }

  _harvestNearbyTree(game) {
    const cx = this.x + Math.floor(this.w / 2);
    const cy = this.y + Math.floor(this.h / 2);
    for (let dy = -this.searchRadius; dy <= this.searchRadius; dy++) {
      for (let dx = -this.searchRadius; dx <= this.searchRadius; dx++) {
        const tx = cx + dx, ty = cy + dy;
        if (game.map.isTree(tx, ty)) {
          game.resources.wood += game.map.cutTree(tx, ty);
          return;
        }
      }
    }
  }

  addWorker(inh) {
    if (!this.needsWorkers) return false;
    this.workers.push(inh);
    inh.job = this.def.job || null;
    inh.workplace = this;
    return true;
  }

  removeWorker(inh) {
    this.workers = this.workers.filter(w => w !== inh);
    if (inh.workplace === this) {
      inh.workplace = null;
      inh.job = null;
    }
  }

  addResident(inh) {
    if (this.residents.length >= (this.def.capacity || 4)) return false;
    this.residents.push(inh);
    inh.home = this;
    return true;
  }

  removeResident(inh) {
    this.residents = this.residents.filter(r => r !== inh);
    if (inh.home === this) inh.home = null;
  }
}
