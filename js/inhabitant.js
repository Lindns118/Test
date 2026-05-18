let _inhId = 0;

const INH_COLORS_M = ['#4a7abf', '#3a6aaf', '#5a8acf', '#2a5a9f', '#6a9adf'];
const INH_COLORS_F = ['#cf6a9a', '#bf5a8a', '#df7aaa', '#af4a7a', '#ef8aba'];

class Inhabitant {
  constructor(tx, ty, gender, age) {
    this.id = _inhId++;
    this.x = tx * TILE_SIZE + TILE_SIZE / 2;
    this.y = ty * TILE_SIZE + TILE_SIZE / 2;
    this.gender = gender;
    this.age = (age !== undefined ? age : AGE_ADULT + 5 + Math.random() * 20) * TICKS_PER_YEAR;
    this.alive = true;

    this.home = null;
    this.workplace = null;
    this.job = null;
    this.partner = null;

    this.state = 'idle';
    this.stateTimer = Math.floor(Math.random() * 120);

    this.path = [];
    this.targetX = this.x;
    this.targetY = this.y;
    this.speed = 0.9 + Math.random() * 0.5;

    this.hunger = 80 + Math.random() * 20;
    this.health = 90 + Math.random() * 10;

    this.birthTimer = Math.floor(Math.random() * 400);
    this.color = gender === GENDER.M
      ? INH_COLORS_M[this.id % INH_COLORS_M.length]
      : INH_COLORS_F[this.id % INH_COLORS_F.length];
  }

  get isAdult() { return this.age >= AGE_ADULT * TICKS_PER_YEAR; }
  get isSenior() { return this.age >= AGE_SENIOR * TICKS_PER_YEAR; }
  get isMale() { return this.gender === GENDER.M; }
  get isFemale() { return this.gender === GENDER.F; }
  get tileX() { return Math.floor(this.x / TILE_SIZE); }
  get tileY() { return Math.floor(this.y / TILE_SIZE); }
  get displayAge() { return Math.floor(this.age / TICKS_PER_YEAR); }

  update(game) {
    if (!this.alive) return;

    // Aging
    this.age++;
    const maxAge = (AGE_MAX + Math.floor(this.id % 10)) * TICKS_PER_YEAR;
    if (this.age >= maxAge) {
      this._die(game, 'vieillesse');
      return;
    }

    // Hunger every 18 ticks (staggered by id)
    if (game.time % 18 === this.id % 18) {
      this.hunger -= 0.18;
      if (this.hunger <= 0) {
        this.health -= 1;
        if (this.health <= 0) {
          this._die(game, 'famine');
          return;
        }
      } else if (this.hunger < 30 && game.resources.food > 0) {
        this._eat(game);
      }
      if (this.hunger > 55 && this.health < 100) {
        this.health = Math.min(100, this.health + 0.25);
      }
    }

    // Birth tick (females in couple, adult, not senior)
    if (this.isFemale && this.partner && this.isAdult && !this.isSenior) {
      this.birthTimer++;
      if (this.birthTimer >= 350 + Math.floor(Math.random() * 250)) {
        this.birthTimer = 0;
        if (game.resources.food >= 10 && this.home) {
          game.birthChild(this);
        }
      }
    }

    this._move();
    this._updateState(game);
  }

  _eat(game) {
    const amount = Math.min(18, game.resources.food, 100 - this.hunger);
    if (amount <= 0) return;
    game.resources.food -= amount;
    this.hunger += amount;
  }

  _die(game, reason) {
    this.alive = false;
    if (this.partner) this.partner.partner = null;
    if (this.home) this.home.removeResident(this);
    if (this.workplace) this.workplace.removeWorker(this);
    game.notify(`${this.isMale ? 'Un homme' : 'Une femme'} est mort(e) de ${reason}.`);
  }

  _updateState(game) {
    this.stateTimer++;

    switch (this.state) {
      case 'idle':
        if (this.stateTimer >= 80 + Math.floor(this.id % 40)) {
          this._decideAction(game);
          this.stateTimer = 0;
        }
        break;

      case 'going_to_work':
        if (this._isAtTarget()) {
          if (this.workplace) this._setState('working');
          else this._setState('idle');
        }
        break;

      case 'working':
        if (this.stateTimer >= 180 + Math.floor(Math.random() * 80)) {
          this._setState('going_home');
          if (this.home) this._pathToBuilding(game, this.home);
        }
        break;

      case 'going_home':
        if (this._isAtTarget()) this._setState('at_home');
        break;

      case 'at_home':
        if (this.stateTimer >= 120) this._setState('idle');
        break;

      case 'wandering':
        if (this._isAtTarget() || this.stateTimer >= 250) this._setState('idle');
        break;
    }
  }

  _decideAction(game) {
    // Hungry? Eat now
    if (this.hunger < 45 && game.resources.food > 0) {
      this._eat(game);
    }

    // Children just wander
    if (!this.isAdult) {
      this._wander(game);
      return;
    }

    // Try to form a couple
    if (!this.partner && Math.random() < 0.08) {
      const mate = game.findMate(this);
      if (mate) {
        this.partner = mate;
        mate.partner = this;
        game.notify(`Un couple s'est formé ! 💑`);
      }
    }

    const isNight = game.time % 200 > 140;

    if (isNight) {
      if (this.home) {
        this._setState('going_home');
        this._pathToBuilding(game, this.home);
      } else {
        this._wander(game);
      }
      return;
    }

    // Go to work
    if (this.workplace) {
      this._setState('going_to_work');
      this._pathToBuilding(game, this.workplace);
      return;
    }

    this._wander(game);
  }

  _wander(game) {
    this._setState('wandering');
    const wx = Math.max(0, Math.min(MAP_W - 1, this.tileX + Math.floor((Math.random() - 0.5) * 10)));
    const wy = Math.max(0, Math.min(MAP_H - 1, this.tileY + Math.floor((Math.random() - 0.5) * 10)));
    this._pathTo(game, wx, wy);
  }

  _pathToBuilding(game, building) {
    const e = building.entryTile;
    this._pathTo(game, e.x, Math.min(e.y, MAP_H - 1));
  }

  _pathTo(game, tx, ty) {
    this.path = findPath(game, this.tileX, this.tileY, tx, ty);
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

  _setState(s) {
    this.state = s;
    this.stateTimer = 0;
  }
}
