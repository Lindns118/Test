class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    this.SPEEDS = [1, 3, 6];
    this.speedIndex = 0;

    this.map = new GameMap(MAP_W, MAP_H);
    this.buildings = [];
    this.inhabitants = [];
    this.resources = { wood: 60, food: 50, gold: 25 };
    this.time = 0;
    this.camera = { x: 0, y: 0, zoom: 1 };

    window.addEventListener('resize', () => this._resize());
    this._resize();

    this.renderer = new Renderer(this);
    this.ui = new UI(this);

    this._init();
    this._loop();
  }

  _resize() {
    const mobile = window.innerWidth <= 640;
    this.canvas.width  = mobile ? window.innerWidth : Math.max(400, window.innerWidth - 280);
    this.canvas.height = window.innerHeight;
    // On mobile, position canvas to fill whole screen
    this.canvas.style.width  = this.canvas.width + 'px';
    this.canvas.style.height = this.canvas.height + 'px';
  }

  _init() {
    const cx = Math.floor(MAP_W / 2);
    const cy = Math.floor(MAP_H / 2);

    // Center camera
    this.camera.x = (cx * TILE_SIZE) * this.camera.zoom - this.canvas.width / 2;
    this.camera.y = (cy * TILE_SIZE) * this.camera.zoom - this.canvas.height / 2;

    // Clear starting area
    this.map.clearArea(cx - 7, cy - 5, 14, 12);

    // Starting buildings (free)
    this._placeBuilding('house',     cx - 5, cy - 2, true);
    this._placeBuilding('house',     cx - 2, cy - 2, true);
    this._placeBuilding('warehouse', cx + 2, cy - 2, true);

    // Starting population: 4 adults (2 couples) + 2 children
    const startPeople = [
      { gender: GENDER.M, age: 22 },
      { gender: GENDER.F, age: 20 },
      { gender: GENDER.M, age: 28 },
      { gender: GENDER.F, age: 26 },
      { gender: GENDER.M, age: 8  },
      { gender: GENDER.F, age: 10 },
    ];

    for (let i = 0; i < startPeople.length; i++) {
      const p = startPeople[i];
      const tx = cx - 2 + (i % 3);
      const ty = cy + 1 + Math.floor(i / 3);
      const inh = new Inhabitant(tx, ty, p.gender, p.age);
      this.inhabitants.push(inh);
    }

    // Pre-couple the adults
    this.inhabitants[0].partner = this.inhabitants[1];
    this.inhabitants[1].partner = this.inhabitants[0];
    this.inhabitants[2].partner = this.inhabitants[3];
    this.inhabitants[3].partner = this.inhabitants[2];

    this._assignHomes();
    this._assignJobs();
  }

  _loop() {
    const stepsPerFrame = this.SPEEDS[this.speedIndex];
    for (let s = 0; s < stepsPerFrame; s++) {
      this._update();
    }
    this.renderer.render();
    this.ui.update();
    requestAnimationFrame(() => this._loop());
  }

  _update() {
    this.time++;

    this.map.update();

    for (const b of this.buildings) b.update(this);

    for (const inh of this.inhabitants) {
      if (inh.alive) inh.update(this);
    }

    // Remove dead
    const before = this.inhabitants.length;
    this.inhabitants = this.inhabitants.filter(i => i.alive);

    // Reassign on death
    if (this.inhabitants.length < before) {
      this._assignJobs();
      this._assignHomes();
    }

    // Periodic job/home assignment
    if (this.time % 90 === 0) {
      this._assignJobs();
      this._assignHomes();
    }

    // Food demand is handled per-inhabitant in Inhabitant.update()
  }

  // ─── Building Placement ──────────────────────────────────────────

  canPlaceBuilding(type, x, y) {
    const def = BDEF[type];
    if (!def) return false;
    if (x < 0 || y < 0 || x + def.w > MAP_W || y + def.h > MAP_H) return false;

    for (let dy = 0; dy < def.h; dy++) {
      for (let dx = 0; dx < def.w; dx++) {
        const tile = this.map.getTile(x + dx, y + dy);
        if (tile === TILE.WATER || tile === TILE.ROCK) return false;
      }
    }

    for (const b of this.buildings) {
      if (x < b.x + b.w && x + def.w > b.x &&
          y < b.y + b.h && y + def.h > b.y) {
        return false;
      }
    }
    return true;
  }

  tryPlaceBuilding(type, x, y) {
    if (!this.canPlaceBuilding(type, x, y)) {
      this.ui.showInfo('❌ Impossible de construire ici !', true);
      return false;
    }
    const def = BDEF[type];
    for (const [r, v] of Object.entries(def.cost)) {
      if ((this.resources[r] || 0) < v) {
        this.ui.showInfo(`❌ Ressources insuffisantes pour ${def.name}`, true);
        return false;
      }
    }
    for (const [r, v] of Object.entries(def.cost)) this.resources[r] -= v;

    const b = this._placeBuilding(type, x, y, false);
    this.ui.showInfo(`✅ ${def.name} construite !`);
    this._assignJobs();
    this._assignHomes();
    return b;
  }

  _placeBuilding(type, x, y, free) {
    if (!free) {
      // costs already deducted by tryPlaceBuilding
    }
    const b = new Building(type, x, y);
    this.buildings.push(b);
    this.map.clearArea(x, y, b.w, b.h);
    return b;
  }

  // ─── Population ──────────────────────────────────────────────────

  birthChild(mother) {
    const home = mother.home;
    if (!home || home.residents.length >= (home.def.capacity || 4)) return;

    const gender = Math.random() < 0.5 ? GENDER.M : GENDER.F;
    const tx = home.x + Math.floor(home.w / 2);
    const ty = home.y + home.h;
    const child = new Inhabitant(tx, ty, gender, 0);
    this.inhabitants.push(child);
    this._assignHomes();
    this.notify(`👶 Naissance ! La population grandit.`);
  }

  findMate(inh) {
    const targetGender = inh.isMale ? GENDER.F : GENDER.M;
    let best = null;
    let bestDist = Infinity;

    for (const c of this.inhabitants) {
      if (c === inh || !c.alive || c.gender !== targetGender) continue;
      if (c.partner || !c.isAdult || c.isSenior) continue;
      const dx = c.x - inh.x, dy = c.y - inh.y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; best = c; }
    }
    return best;
  }

  // ─── Job & Home Assignment ───────────────────────────────────────

  _assignJobs() {
    for (const b of this.buildings) {
      if (b.def.workers_needed === 0) continue;
      // Clean dead workers
      b.workers = b.workers.filter(w => w.alive);
      b.workers.forEach(w => { if (w.workplace !== b) { w.workplace = b; w.job = b.def.job; } });
    }

    const unemployed = this.inhabitants.filter(
      i => i.alive && i.isAdult && !i.workplace
    );

    for (const b of this.buildings) {
      if (b.def.workers_needed === 0) continue;
      for (const inh of unemployed) {
        if (inh.workplace) continue;
        if (b.needsWorkers) b.addWorker(inh);
      }
    }
  }

  _assignHomes() {
    for (const b of this.buildings) {
      if (!b.isHouse) continue;
      b.residents = b.residents.filter(r => r.alive);
      b.residents.forEach(r => { if (r.home !== b) r.home = b; });
    }

    const homeless = this.inhabitants.filter(i => i.alive && !i.home);
    for (const b of this.buildings) {
      if (!b.isHouse) continue;
      for (const inh of homeless) {
        if (inh.home) continue;
        b.addResident(inh);
      }
    }
  }

  // ─── Notifications ───────────────────────────────────────────────

  notify(msg) {
    this.ui.pushLog(msg);
  }
}

window.addEventListener('load', () => { window.game = new Game(); });
