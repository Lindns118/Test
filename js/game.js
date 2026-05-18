class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // Speeds: [1, 2, 4] ticks per frame
    this.SPEEDS = [1, 2, 4];
    this.speedIndex = 0;

    this.map = new GameMap(MAP_W, MAP_H);
    this.buildings = [];
    this.animals = [];    // flat list of all animals
    this.visitors = [];   // active visitors
    this.employees = [];

    this.resources = { money: 3000 };
    this.ticketPrice = 15;
    this.reputation = 40; // 0-100
    this.time = 0;
    this.dayTimer = 0;

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
    this.canvas.style.width  = this.canvas.width + 'px';
    this.canvas.style.height = this.canvas.height + 'px';
  }

  _init() {
    const cx = Math.floor(MAP_W / 2);

    // Center camera on entrance area (top-center)
    this.camera.x = (cx * TILE_SIZE) * this.camera.zoom - this.canvas.width / 2;
    this.camera.y = 0;

    // Place entrance at top center, free of charge
    const ex = cx - 2; // w=4, so center at cx
    const ey = 5;
    this._placeBuilding('entrance', ex, ey, true);

    // Place 6 PATH tiles below the entrance to guide visitors
    for (let i = 0; i < 6; i++) {
      const px = cx - 2 + Math.floor(BDEF.entrance.w / 2); // center column of entrance
      const py = ey + BDEF.entrance.h + i;
      if (this.map.inBounds(px, py)) {
        this.map.setTile(px, py, TILE.PATH);
      }
    }

    // Also place paths 1 tile to left and right to widen entrance path
    for (let i = 0; i < 4; i++) {
      const py = ey + BDEF.entrance.h + i;
      const pxL = cx - 2 + Math.floor(BDEF.entrance.w / 2) - 1;
      const pxR = cx - 2 + Math.floor(BDEF.entrance.w / 2) + 1;
      if (this.map.inBounds(pxL, py)) this.map.setTile(pxL, py, TILE.PATH);
      if (this.map.inBounds(pxR, py)) this.map.setTile(pxR, py, TILE.PATH);
    }
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
    this.dayTimer++;

    if (this.dayTimer >= TICKS_PER_DAY) {
      this.dayTimer = 0;
      this._processDailyFinances();
      this._spawnVisitors();
    }

    // Update buildings
    for (const b of this.buildings) b.update(this);

    // Update animals
    for (const a of this.animals) a.update();

    // Update employees
    for (const emp of this.employees) emp.update(this);

    // Update visitors
    for (const v of this.visitors) {
      if (v.alive) v.update(this);
    }

    // Remove departed visitors
    this.visitors = this.visitors.filter(v => v.alive);
  }

  // ─── Daily Finances ───────────────────────────────────────────────

  _processDailyFinances() {
    let income = 0;
    let expenses = 0;

    const visitorsCount = this.visitors.length;

    // Revenue from shops and restaurants
    for (const b of this.buildings) {
      if (b.def.revenue_visitor) {
        const shopRevenue = visitorsCount * b.def.revenue_visitor;
        income += shopRevenue;
      }
    }

    // Wages for keeper cabins
    for (const b of this.buildings) {
      if (b.def.wage_day) {
        expenses += b.def.wage_day;
      }
    }

    // Food costs for enclosures
    for (const b of this.buildings) {
      if (b.def.food_day) {
        expenses += b.def.food_day;
      }
    }

    const net = income - expenses;
    this.resources.money += net;

    // Log daily summary
    const totalDays = Math.floor(this.time / TICKS_PER_DAY);
    const monthIdx = totalDays % 12;
    const monthName = MONTHS[monthIdx];

    if (income > 0 || expenses > 0) {
      this.notify(`📊 ${monthName}: +${income}💵 recettes, -${expenses}💵 coûts (bilan: ${net >= 0 ? '+' : ''}${net}💵)`);
    }
  }

  // ─── Visitor Spawning ─────────────────────────────────────────────

  _spawnVisitors() {
    const entrance = this.buildings.find(b => b.type === 'entrance');
    if (!entrance) return;

    // Only spawn if there are enclosures to visit
    const enclosures = this.buildings.filter(b => b.def.isEnclosure);
    if (enclosures.length === 0) return;

    const maxVisitors = Math.floor(this.reputation / 5) + 3;
    if (this.visitors.length >= maxVisitors) return;

    const slots = maxVisitors - this.visitors.length;
    const n = Math.min(slots, 1 + Math.floor(Math.random() * 3));

    for (let i = 0; i < n; i++) {
      const v = new Visitor(entrance, this);
      this.visitors.push(v);
    }

    if (n > 0) {
      this.notify(`🎪 ${n} nouveau${n > 1 ? 'x' : ''} visiteur${n > 1 ? 's' : ''} entré${n > 1 ? 's' : ''} !`);
    }
  }

  // ─── Visitor Leave ────────────────────────────────────────────────

  onVisitorLeave(visitor) {
    // Ticket revenue
    this.resources.money += this.ticketPrice;

    // Reputation impact based on happiness
    if (visitor.happiness > 65) {
      this.reputation = Math.min(100, this.reputation + 1);
    } else if (visitor.happiness < 35) {
      this.reputation = Math.max(0, this.reputation - 1);
    }
  }

  // ─── Building Placement ──────────────────────────────────────────

  canPlaceBuilding(type, x, y, excludeId = null) {
    const def = BDEF[type];
    if (!def) return false;
    if (x < 0 || y < 0 || x + def.w > MAP_W || y + def.h > MAP_H) return false;

    // Path: only on GRASS
    if (def.isPath) {
      const tile = this.map.getTile(x, y);
      return tile === TILE.GRASS;
    }

    // Buildings: no water allowed
    for (let dy = 0; dy < def.h; dy++) {
      for (let dx = 0; dx < def.w; dx++) {
        const tile = this.map.getTile(x + dx, y + dy);
        if (tile === TILE.WATER) return false;
      }
    }

    // No overlap with existing buildings (skip the building being moved)
    for (const b of this.buildings) {
      if (excludeId !== null && b.id === excludeId) continue;
      if (x < b.x + b.w && x + def.w > b.x &&
          y < b.y + b.h && y + def.h > b.y) {
        return false;
      }
    }
    return true;
  }

  moveBuilding(building, x, y) {
    if (!this.canPlaceBuilding(building.type, x, y, building.id)) {
      this.ui.showInfo('❌ Impossible de déplacer ici !', true);
      return false;
    }

    // Restore old footprint to GRASS
    for (let dy = 0; dy < building.h; dy++) {
      for (let dx = 0; dx < building.w; dx++) {
        const t = this.map.getTile(building.x + dx, building.y + dy);
        if (t !== TILE.WATER && t !== TILE.TREE) {
          this.map.setTile(building.x + dx, building.y + dy, TILE.GRASS);
        }
      }
    }

    building.x = x;
    building.y = y;
    this.map.clearForBuilding(x, y, building.w, building.h);

    // Reposition animals inside enclosure
    if (building.def.isEnclosure) {
      const margin = TILE_SIZE;
      for (const a of building.animals) {
        a.x = building.x * TILE_SIZE + margin + Math.random() * (building.w * TILE_SIZE - margin * 2);
        a.y = building.y * TILE_SIZE + margin + Math.random() * (building.h * TILE_SIZE - margin * 2);
        a.targetX = a.x;
        a.targetY = a.y;
      }
    }

    this.ui.showInfo(`✅ ${building.def.name} déplacée !`);
    return true;
  }

  tryPlaceBuilding(type, x, y) {
    const def = BDEF[type];

    if (def && def.isBulldoze) {
      const tile = this.map.getTile(x, y);
      if (tile !== TILE.TREE) {
        this.ui.showInfo('❌ Cliquez sur un arbre à couper !', true);
        return false;
      }
      if ((this.resources.money || 0) < def.cost.money) {
        this.ui.showInfo('❌ Ressources insuffisantes !', true);
        return false;
      }
      this.resources.money -= def.cost.money;
      this.map.setTile(x, y, TILE.GRASS);
      this.ui.showInfo('🪓 Arbre coupé !');
      return true;
    }

    // Entrance: only one allowed
    if (type === 'entrance' && this.buildings.find(b => b.type === 'entrance')) {
      this.ui.showInfo('❌ L\'entrée est déjà placée !', true);
      return false;
    }

    if (!this.canPlaceBuilding(type, x, y)) {
      // Silently fail for path painting (avoids spam)
      if (type !== 'path') {
        this.ui.showInfo('❌ Impossible de construire ici !', true);
      }
      return false;
    }

    // Check resources
    for (const [r, v] of Object.entries(def.cost)) {
      if ((this.resources[r] || 0) < v) {
        this.ui.showInfo(`❌ Ressources insuffisantes pour ${def.name}`, true);
        return false;
      }
    }

    // Deduct cost
    for (const [r, v] of Object.entries(def.cost)) {
      this.resources[r] -= v;
    }

    if (def.isPath) {
      // PATH: just set the tile, no Building object created
      this.map.setTile(x, y, TILE.PATH);
      return true;
    }

    // Normal building
    const b = this._placeBuilding(type, x, y, false);
    this.ui.showInfo(`✅ ${def.name} construite !`);
    return b;
  }

  _placeBuilding(type, x, y, free) {
    const b = new Building(type, x, y);
    this.buildings.push(b);
    // Clear underlying tiles (except water) for the building footprint
    this.map.clearForBuilding(x, y, b.w, b.h);

    if (b.def.isEnclosure) {
      b.spawnAnimals(this);
    }

    if (b.def.isStaffBuilding) {
      const emp = new Employee(b.def.staffType, b, this);
      this.employees.push(emp);
    }

    return b;
  }

  setTicketPrice(delta) {
    this.ticketPrice = Math.max(5, Math.min(50, this.ticketPrice + delta));
    this.ui.updateTicketDisplay();
  }

  // ─── Restart ─────────────────────────────────────────────────────

  restart() {
    if (!confirm('Recommencer depuis le début ?')) return;

    _buildingId = 0;
    _visitorId  = 0;
    _employeeId = 0;

    this.map = new GameMap(MAP_W, MAP_H);
    this.buildings = [];
    this.animals = [];
    this.visitors = [];
    this.employees = [];
    this.resources = { money: 3000 };
    this.reputation = 40;
    this.time = 0;
    this.dayTimer = 0;
    this.ticketPrice = 15;

    this.camera = { x: 0, y: 0, zoom: 1 };

    this.ui._deselect();
    this.ui._elLog.innerHTML = '';
    this.ui._showToast('Nouvelle partie !');

    this._init();
  }

  // ─── Notifications ───────────────────────────────────────────────

  notify(msg) {
    this.ui.pushLog(msg);
  }
}

window.addEventListener('load', () => { window.game = new Game(); });
