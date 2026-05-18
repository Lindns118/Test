let _employeeId = 0;

const EMPLOYEE_COLORS = {
  keeper:  { shirt: '#2e7d32', hat: '#1b5e20' },
  cleaner: { shirt: '#1565c0', hat: '#0d47a1' },
};

class Employee {
  constructor(type, homeBuilding, game) {
    this.id = _employeeId++;
    this.type = type;
    this.home = homeBuilding;
    this.alive = true;

    const hx = homeBuilding.x + Math.floor(homeBuilding.w / 2);
    const hy = homeBuilding.y + homeBuilding.h;
    this.x = hx * TILE_SIZE + TILE_SIZE / 2;
    this.y = hy * TILE_SIZE + TILE_SIZE / 2;
    this.targetX = this.x;
    this.targetY = this.y;
    this.speed = 0.9;

    this.state = 'idle';
    this.stateTimer = 0;
    this.workTimer = 0;
    this.path = [];
    this.assignedBuilding = null;
    this.colors = EMPLOYEE_COLORS[type];
  }

  get tileX() { return Math.floor(this.x / TILE_SIZE); }
  get tileY() { return Math.floor(this.y / TILE_SIZE); }

  update(game) {
    this.stateTimer++;

    switch (this.state) {
      case 'idle':    this._updateIdle(game);    break;
      case 'going':   this._updateGoing(game);   break;
      case 'working': this._updateWorking(game); break;
      case 'back':    this._updateBack(game);    break;
    }

    this._move();
  }

  _updateIdle(game) {
    if (this.stateTimer < 180) return;
    this.stateTimer = 0;

    if (this.type === 'keeper') {
      const enclosures = game.buildings.filter(b => b.def.isEnclosure);
      if (!enclosures.length) return;
      const target = enclosures[Math.floor(Math.random() * enclosures.length)];
      this.assignedBuilding = target;
      const et = target.entryTile;
      this.path = findPathWeighted(game, this.tileX, this.tileY, et.x, et.y);
    } else {
      // Cleaner: pick a random path tile near center
      const pathTiles = [];
      for (let y = 0; y < MAP_H; y += 3) {
        for (let x = 0; x < MAP_W; x += 3) {
          if (game.map.getTile(x, y) === TILE.PATH) pathTiles.push({ x, y });
        }
      }
      if (!pathTiles.length) return;
      const target = pathTiles[Math.floor(Math.random() * Math.min(pathTiles.length, 20))];
      this.assignedBuilding = null;
      this.path = findPathWeighted(game, this.tileX, this.tileY, target.x, target.y);
    }

    this._advancePath();
    this.state = 'going';
  }

  _updateGoing(game) {
    if (!this._isAtTarget()) return;
    this.state = 'working';
    this.stateTimer = 0;
    this.workTimer = 0;
  }

  _updateWorking(game) {
    this.workTimer++;

    if (this.type === 'keeper' && this.workTimer % 90 === 0) {
      game.reputation = Math.min(100, game.reputation + 0.3);
    }

    if (this.workTimer >= 250) {
      const ht = this.home.entryTile;
      this.path = findPathWeighted(game, this.tileX, this.tileY, ht.x, ht.y);
      this._advancePath();
      this.state = 'back';
      this.stateTimer = 0;
    }
  }

  _updateBack(game) {
    if (!this._isAtTarget()) return;
    this.state = 'idle';
    this.stateTimer = 0;
  }

  _advancePath() {
    if (!this.path.length) return;
    const next = this.path.shift();
    this.targetX = next.x * TILE_SIZE + TILE_SIZE / 2;
    this.targetY = next.y * TILE_SIZE + TILE_SIZE / 2;
  }

  _move() {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= this.speed) {
      this.x = this.targetX;
      this.y = this.targetY;
      this._advancePath();
    } else {
      this.x += (dx / dist) * this.speed;
      this.y += (dy / dist) * this.speed;
    }
  }

  _isAtTarget() {
    return this.path.length === 0 &&
           Math.abs(this.x - this.targetX) < 2 &&
           Math.abs(this.y - this.targetY) < 2;
  }
}
