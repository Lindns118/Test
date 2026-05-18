let _visitorId = 0;

class Visitor {
  constructor(entrance, game) {
    this.id = _visitorId++;
    this.alive = true;

    // Spawn position: at the entrance tile
    const et = entrance.entranceTile;
    this.x = et.x * TILE_SIZE + TILE_SIZE / 2;
    this.y = et.y * TILE_SIZE + TILE_SIZE / 2;

    this.happiness = 40;
    this.energy = 100;
    this.money = 30 + Math.floor(Math.random() * 41); // 30-70

    // Build wishlist: 2-4 random enclosures from those that exist
    const enclosures = game.buildings.filter(b => b.def.isEnclosure);
    const shuffled = enclosures.slice().sort(() => Math.random() - 0.5);
    const wishCount = 2 + Math.floor(Math.random() * 3); // 2-4
    this.wishList = shuffled.slice(0, wishCount).map(b => b.id);
    this.visited = new Set();

    this.state = 'idle'; // 'idle' | 'going' | 'watching' | 'leaving'
    this.stateTimer = 0;
    this.decideTimer = Math.floor(Math.random() * 60); // stagger decisions

    this.path = [];
    this.targetX = this.x;
    this.targetY = this.y;
    this.speed = 1.1 + Math.random() * 0.6;

    this.color = VISITOR_COLORS[this.id % VISITOR_COLORS.length];

    this.currentTarget = null; // building id being visited
    this.watchTimer = 0;
    this.watchDuration = 0;

    // Revenue ticket flag (only paid once at entrance)
    this._ticketPaid = false;

    this._soughtBench = false;
    this._usedToilet = false;
    this._restTimer = 0;
  }

  get tileX() { return Math.floor(this.x / TILE_SIZE); }
  get tileY() { return Math.floor(this.y / TILE_SIZE); }

  update(game) {
    if (!this.alive) return;

    // Energy drains slowly
    this.energy -= 0.015;

    this.stateTimer++;
    this.decideTimer++;

    switch (this.state) {
      case 'idle':
        this._updateIdle(game);
        break;
      case 'going':
        this._updateGoing(game);
        break;
      case 'watching':
        this._updateWatching(game);
        break;
      case 'leaving':
        this._updateLeaving(game);
        break;
      case 'resting':
        this._updateResting(game);
        break;
      case 'going_toilet':
        this._updateGoingToilet(game);
        break;
    }

    this._move();
  }

  _updateIdle(game) {
    // Check leave conditions
    if (this.energy <= 0 || this.wishList.length === 0) {
      this._startLeaving(game);
      return;
    }

    // Seek bench if energy low
    if (this.energy < 35 && !this._soughtBench) {
      const benches = game.buildings.filter(b => b.def.isBench);
      if (benches.length > 0) {
        const bench = benches.reduce((best, b) => {
          const dx = b.x * TILE_SIZE - this.x, dy = b.y * TILE_SIZE - this.y;
          const d2 = dx*dx + dy*dy;
          const bd = (()=>{ const bx=best.x*TILE_SIZE-this.x, by=best.y*TILE_SIZE-this.y; return bx*bx+by*by; })();
          return d2 < bd ? b : best;
        });
        this._soughtBench = true;
        this.currentTarget = bench;
        this._pathToBuilding(game, bench);
        this.state = 'resting';
        this.stateTimer = 0;
        this._restTimer = 0;
        return;
      }
    }

    // Seek toilet if visited 2+ enclosures and toilets exist
    if (!this._usedToilet && this.visited.size >= 2) {
      const toilets = game.buildings.filter(b => b.type === 'toilets');
      if (toilets.length > 0) {
        const toilet = toilets[0];
        this._usedToilet = true;
        this._pathToBuilding(game, toilet);
        this.state = 'going_toilet';
        this.stateTimer = 0;
        return;
      }
    }

    // Decide every ~60 ticks
    if (this.decideTimer < 60) return;
    this.decideTimer = 0;

    // Pick next enclosure to visit
    const remaining = this.wishList.filter(id => !this.visited.has(id));
    if (remaining.length === 0) {
      this._startLeaving(game);
      return;
    }

    // Find enclosure building by id
    const targetId = remaining[0];
    const target = game.buildings.find(b => b.id === targetId);
    if (!target) {
      // Building no longer exists, remove from wishlist
      this.wishList = this.wishList.filter(id => id !== targetId);
      return;
    }

    this.currentTarget = target;
    this._pathToBuilding(game, target);
    this.state = 'going';
    this.stateTimer = 0;
  }

  _updateGoing(game) {
    if (this.energy <= 0) {
      this._startLeaving(game);
      return;
    }

    if (this._isAtTarget()) {
      // Arrived at enclosure
      if (this.currentTarget) {
        this.visited.add(this.currentTarget.id);
        this.wishList = this.wishList.filter(id => id !== this.currentTarget.id);
      }
      this.state = 'watching';
      this.stateTimer = 0;
      this.watchTimer = 0;
      this.watchDuration = 150 + Math.floor(Math.random() * 101); // 150-250
    }
  }

  _updateWatching(game) {
    this.watchTimer++;

    // Happiness boost every 30 ticks while watching
    if (this.watchTimer % 30 === 0) {
      this.happiness = Math.min(100, this.happiness + 4);
    }

    if (this.watchTimer >= this.watchDuration) {
      this.state = 'idle';
      this.stateTimer = 0;
      this.decideTimer = 60; // decide immediately
    }
  }

  _updateLeaving(game) {
    if (this._isAtTarget()) {
      // Reached entrance — leave
      game.onVisitorLeave(this);
      this.alive = false;
    }
  }

  _updateResting(game) {
    this._restTimer = (this._restTimer || 0) + 1;
    this.energy = Math.min(100, this.energy + 0.4);
    if (this._restTimer >= 120) {
      this.state = 'idle';
      this.stateTimer = 0;
      this.decideTimer = 60;
    }
  }

  _updateGoingToilet(game) {
    if (this.energy <= 0) { this._startLeaving(game); return; }
    if (this._isAtTarget()) {
      this.happiness = Math.min(100, this.happiness + 12);
      this.state = 'idle';
      this.stateTimer = 0;
      this.decideTimer = 60;
    }
  }

  _startLeaving(game) {
    this.state = 'leaving';
    this.stateTimer = 0;
    // Find entrance
    const entrance = game.buildings.find(b => b.type === 'entrance');
    if (entrance) {
      this._pathToBuilding(game, entrance);
    } else {
      this.alive = false;
    }
  }

  _pathToBuilding(game, building) {
    const e = building.entryTile;
    const tx = Math.max(0, Math.min(MAP_W - 1, e.x));
    const ty = Math.max(0, Math.min(MAP_H - 1, e.y));
    this.path = findPathWeighted(game, this.tileX, this.tileY, tx, ty);
    this._advancePath();
  }

  _advancePath() {
    if (this.path.length === 0) return;
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
