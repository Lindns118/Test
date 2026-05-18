class UI {
  constructor(game) {
    this.game = game;
    this.selectedBuildType = null;
    this.hx = -1;
    this.hy = -1;

    this._elWood  = document.getElementById('res-wood');
    this._elFood  = document.getElementById('res-food');
    this._elGold  = document.getElementById('res-gold');
    this._elPop   = document.getElementById('res-pop');
    this._elTime  = document.getElementById('res-time');
    this._elInfo  = document.getElementById('info-text');
    this._elLog   = document.getElementById('event-log');
    this._elSpeed = document.getElementById('speed-btn');

    this._buildBuildingButtons();
    this._setupCanvas();
    this._setupSpeedBtn();
  }

  _buildBuildingButtons() {
    const container = document.getElementById('build-buttons');
    for (const [type, def] of Object.entries(BDEF)) {
      const costParts = Object.entries(def.cost).map(([r, v]) => {
        const icon = r === 'wood' ? '🪵' : r === 'food' ? '🌾' : '💰';
        return `${v}${icon}`;
      }).join(' ');

      const btn = document.createElement('button');
      btn.className = 'build-btn';
      btn.dataset.type = type;
      btn.style.borderLeft = `4px solid ${def.color}`;
      btn.title = def.description;
      btn.innerHTML = `<span class="btn-name">${def.icon} ${def.name}</span><span class="btn-cost">${costParts}</span>`;

      btn.addEventListener('click', () => {
        if (this.selectedBuildType === type) {
          this._deselect();
        } else {
          this._select(type, btn);
        }
      });

      container.appendChild(btn);
    }
  }

  _select(type, btn) {
    document.querySelectorAll('.build-btn').forEach(b => b.classList.remove('active'));
    this.selectedBuildType = type;
    btn.classList.add('active');
    this._elInfo.textContent = BDEF[type].description;
  }

  _deselect() {
    this.selectedBuildType = null;
    document.querySelectorAll('.build-btn').forEach(b => b.classList.remove('active'));
    this._elInfo.textContent = 'Clic droit ou Échap pour annuler.';
  }

  _setupCanvas() {
    const canvas = this.game.canvas;
    let dragging = false;
    let dragStart = { x: 0, y: 0 };
    let camStart = { x: 0, y: 0 };
    let moved = false;

    canvas.addEventListener('mousedown', (e) => {
      dragging = true;
      moved = false;
      dragStart = { x: e.clientX, y: e.clientY };
      camStart = { x: this.game.camera.x, y: this.game.camera.y };
    });

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const { camera } = this.game;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      this.hx = Math.floor((sx + camera.x) / camera.zoom / TILE_SIZE);
      this.hy = Math.floor((sy + camera.y) / camera.zoom / TILE_SIZE);

      if (dragging) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        if (moved && !this.selectedBuildType) {
          this.game.camera.x = camStart.x - dx;
          this.game.camera.y = camStart.y - dy;
          this._clampCamera();
        }
      }
    });

    canvas.addEventListener('mouseup', () => {
      if (!moved && this.selectedBuildType) {
        this.game.tryPlaceBuilding(this.selectedBuildType, this.hx, this.hy);
      }
      dragging = false;
    });

    canvas.addEventListener('mouseleave', () => {
      dragging = false;
      this.hx = -1;
      this.hy = -1;
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { camera } = this.game;

      const wx = (sx + camera.x) / camera.zoom;
      const wy = (sy + camera.y) / camera.zoom;

      camera.zoom = Math.max(0.25, Math.min(2.5, camera.zoom * (e.deltaY > 0 ? 0.88 : 1.14)));

      camera.x = wx * camera.zoom - sx;
      camera.y = wy * camera.zoom - sy;
      this._clampCamera();
    }, { passive: false });

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this._deselect();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this._deselect();
      const spd = 32;
      if (e.key === 'ArrowLeft')  { this.game.camera.x -= spd; this._clampCamera(); }
      if (e.key === 'ArrowRight') { this.game.camera.x += spd; this._clampCamera(); }
      if (e.key === 'ArrowUp')    { this.game.camera.y -= spd; this._clampCamera(); }
      if (e.key === 'ArrowDown')  { this.game.camera.y += spd; this._clampCamera(); }
    });
  }

  _setupSpeedBtn() {
    this._elSpeed.addEventListener('click', () => {
      this.game.speedIndex = (this.game.speedIndex + 1) % this.game.SPEEDS.length;
      this._elSpeed.textContent = ['▶ x1', '▶▶ x3', '▶▶▶ x6'][this.game.speedIndex];
    });
  }

  _clampCamera() {
    const { camera, canvas } = this.game;
    const maxX = MAP_W * TILE_SIZE * camera.zoom - canvas.width;
    const maxY = MAP_H * TILE_SIZE * camera.zoom - canvas.height;
    camera.x = Math.max(0, Math.min(Math.max(0, maxX), camera.x));
    camera.y = Math.max(0, Math.min(Math.max(0, maxY), camera.y));
  }

  update() {
    const res = this.game.resources;
    const pop = this.game.inhabitants.filter(i => i.alive);
    const adults = pop.filter(i => i.isAdult).length;
    const children = pop.length - adults;

    this._elWood.textContent  = `🪵 ${Math.floor(res.wood)}`;
    this._elFood.textContent  = `🌾 ${Math.floor(res.food)}`;
    this._elGold.textContent  = `💰 ${Math.floor(res.gold)}`;
    this._elPop.textContent   = `👥 ${adults}${children > 0 ? ` +${children}👶` : ''}`;

    const t = this.game.time;
    const season = SEASONS[Math.floor(t / TICKS_PER_SEASON) % 4];
    const year = Math.floor(t / TICKS_PER_YEAR) + 1;
    this._elTime.textContent  = `An ${year} · ${season}`;

    // Afford check
    document.querySelectorAll('.build-btn').forEach(btn => {
      const def = BDEF[btn.dataset.type];
      if (!def) return;
      const canAfford = Object.entries(def.cost).every(([r, v]) => (res[r] || 0) >= v);
      btn.classList.toggle('cannot-afford', !canAfford);
    });
  }

  pushLog(msg) {
    const li = document.createElement('li');
    li.textContent = msg;
    this._elLog.prepend(li);
    if (this._elLog.children.length > 8) {
      this._elLog.removeChild(this._elLog.lastChild);
    }
  }

  showInfo(msg) {
    this._elInfo.textContent = msg;
  }
}
