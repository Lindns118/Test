const IS_MOBILE = () => window.innerWidth <= 640;

class UI {
  constructor(game) {
    this.game = game;
    this.selectedBuildType = null;
    this.hx = -1;
    this.hy = -1;

    // Desktop elements
    this._elWood  = document.getElementById('res-wood');
    this._elFood  = document.getElementById('res-food');
    this._elGold  = document.getElementById('res-gold');
    this._elPop   = document.getElementById('res-pop');
    this._elTime  = document.getElementById('res-time');
    this._elInfo  = document.getElementById('info-text');
    this._elLog   = document.getElementById('event-log');
    this._elSpeed = document.getElementById('speed-btn');

    // Mobile elements
    this._mWood   = document.getElementById('m-wood');
    this._mFood   = document.getElementById('m-food');
    this._mGold   = document.getElementById('m-gold');
    this._mPop    = document.getElementById('m-pop');
    this._mTime   = document.getElementById('m-time');
    this._mSpeed  = document.getElementById('m-speed');
    this._mCancel = document.getElementById('m-cancel');
    this._mToast  = document.getElementById('m-toast');
    this._mScroll = document.getElementById('m-scroll');
    this._toastTimer = null;

    this._buildDesktopButtons();
    this._buildMobileButtons();
    this._setupCanvas();
    this._setupSpeedBtns();
    this._setupMobileCancel();
    this._setupRestartBtns();
  }

  // ─── Button builders ─────────────────────────────────────

  _buildDesktopButtons() {
    const container = document.getElementById('build-buttons');
    for (const [type, def] of Object.entries(BDEF)) {
      const costStr = this._costStr(def);
      const btn = document.createElement('button');
      btn.className = 'build-btn';
      btn.dataset.type = type;
      btn.dataset.set = 'desktop';
      btn.style.borderLeft = `4px solid ${def.color}`;
      btn.title = def.description;
      btn.innerHTML = `<span class="btn-name">${def.icon} ${def.name}</span><span class="btn-cost">${costStr}</span>`;
      btn.addEventListener('click', () => this._toggle(type));
      container.appendChild(btn);
    }
  }

  _buildMobileButtons() {
    for (const [type, def] of Object.entries(BDEF)) {
      const btn = document.createElement('button');
      btn.className = 'm-build-btn';
      btn.dataset.type = type;
      btn.dataset.set = 'mobile';
      btn.innerHTML = `<span class="m-icon">${def.icon}</span><span class="m-name">${def.name}</span>`;
      btn.style.borderColor = def.color + '88';
      btn.addEventListener('click', () => this._toggle(type));
      this._mScroll.appendChild(btn);
    }
  }

  _costStr(def) {
    return Object.entries(def.cost).map(([r, v]) => {
      const icon = r === 'wood' ? '🪵' : r === 'food' ? '🌾' : '💰';
      return `${v}${icon}`;
    }).join(' ');
  }

  // ─── Selection ───────────────────────────────────────────

  _toggle(type) {
    if (this.selectedBuildType === type) {
      this._deselect();
    } else {
      this._select(type);
    }
  }

  _select(type) {
    this.selectedBuildType = type;
    const def = BDEF[type];

    document.querySelectorAll('[data-type]').forEach(b => {
      b.classList.toggle('active', b.dataset.type === type);
    });

    const msg = `${def.icon} ${def.name} — ${def.description}`;
    this._elInfo.textContent = msg;
    this._showToast(msg);

    if (IS_MOBILE()) {
      this._mCancel.classList.remove('hidden');
    }
  }

  _deselect() {
    this.selectedBuildType = null;
    document.querySelectorAll('[data-type]').forEach(b => b.classList.remove('active'));
    this._elInfo.textContent = 'Sélectionnez un bâtiment, puis cliquez sur la carte.';
    this._mCancel.classList.add('hidden');
  }

  // ─── Canvas input (mouse) ────────────────────────────────

  _setupCanvas() {
    const canvas = this.game.canvas;
    let dragging = false;
    let dragStart = { x: 0, y: 0 };
    let camStart  = { x: 0, y: 0 };
    let moved = false;

    canvas.addEventListener('mousedown', (e) => {
      dragging = true;
      moved = false;
      dragStart = { x: e.clientX, y: e.clientY };
      camStart  = { x: this.game.camera.x, y: this.game.camera.y };
    });

    canvas.addEventListener('mousemove', (e) => {
      this._updateHoverMouse(e);
      if (!dragging) return;
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      if (moved && !this.selectedBuildType) {
        this.game.camera.x = camStart.x - dx;
        this.game.camera.y = camStart.y - dy;
        this._clampCamera();
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
      this._applyZoom(e.clientX, e.clientY, e.deltaY > 0 ? 0.88 : 1.14);
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

    // ── Touch input ──────────────────────────────────────
    let touches = {};
    let pinchDist0 = 0;
    let touchMoved = false;
    let touchStart = { x: 0, y: 0 };
    let camStartT  = { x: 0, y: 0 };

    const touchDist = (t) => {
      const pts = Object.values(t);
      if (pts.length < 2) return 0;
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const touchMid = (t) => {
      const pts = Object.values(t);
      return {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2,
      };
    };

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        touches[t.identifier] = { x: t.clientX, y: t.clientY };
      }
      if (Object.keys(touches).length === 1) {
        const first = Object.values(touches)[0];
        touchStart = { x: first.x, y: first.y };
        camStartT  = { x: this.game.camera.x, y: this.game.camera.y };
        touchMoved = false;
      }
      if (Object.keys(touches).length === 2) {
        pinchDist0 = touchDist(touches);
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (touches[t.identifier]) {
          touches[t.identifier] = { x: t.clientX, y: t.clientY };
        }
      }

      const count = Object.keys(touches).length;

      if (count === 2) {
        // Pinch zoom
        const newDist = touchDist(touches);
        const mid = touchMid(touches);
        if (pinchDist0 > 0 && newDist > 0) {
          this._applyZoom(mid.x, mid.y, newDist / pinchDist0);
        }
        pinchDist0 = newDist;
        touchMoved = true;
      } else if (count === 1) {
        // Pan
        const cur = Object.values(touches)[0];
        const dx = cur.x - touchStart.x;
        const dy = cur.y - touchStart.y;
        if (Math.abs(dx) + Math.abs(dy) > 6) touchMoved = true;
        if (touchMoved) {
          this.game.camera.x = camStartT.x - dx;
          this.game.camera.y = camStartT.y - dy;
          this._clampCamera();
        }
        // Update hover for ghost preview
        this._updateHoverPx(cur.x, cur.y);
      }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        delete touches[t.identifier];
      }

      if (Object.keys(touches).length < 2) pinchDist0 = 0;

      // Tap = place building
      if (!touchMoved && this.selectedBuildType && e.changedTouches.length > 0) {
        const t = e.changedTouches[0];
        this._updateHoverPx(t.clientX, t.clientY);
        this.game.tryPlaceBuilding(this.selectedBuildType, this.hx, this.hy);
      }

      if (Object.keys(touches).length === 0) touchMoved = false;
    }, { passive: false });
  }

  _setupSpeedBtns() {
    const cycle = () => {
      this.game.speedIndex = (this.game.speedIndex + 1) % this.game.SPEEDS.length;
      const labels = ['▶ x1', '▶▶ x3', '▶▶▶ x6'];
      const mLabels = ['▶', '▶▶', '▶▶▶'];
      this._elSpeed.textContent = labels[this.game.speedIndex];
      this._mSpeed.textContent  = mLabels[this.game.speedIndex];
    };
    this._elSpeed.addEventListener('click', cycle);
    this._mSpeed.addEventListener('click', cycle);
  }

  _setupMobileCancel() {
    this._mCancel.addEventListener('click', () => this._deselect());
  }

  _setupRestartBtns() {
    document.getElementById('restart-btn').addEventListener('click', () => this.game.restart());
    document.getElementById('m-restart').addEventListener('click',   () => this.game.restart());
  }

  // ─── Camera helpers ──────────────────────────────────────

  _applyZoom(screenX, screenY, ratio) {
    const { camera } = this.game;
    const wx = (screenX + camera.x) / camera.zoom;
    const wy = (screenY + camera.y) / camera.zoom;
    camera.zoom = Math.max(0.25, Math.min(2.5, camera.zoom * ratio));
    camera.x = wx * camera.zoom - screenX;
    camera.y = wy * camera.zoom - screenY;
    this._clampCamera();
  }

  _clampCamera() {
    const { camera, canvas } = this.game;
    const maxX = MAP_W * TILE_SIZE * camera.zoom - canvas.width;
    const maxY = MAP_H * TILE_SIZE * camera.zoom - canvas.height;
    camera.x = Math.max(0, Math.min(Math.max(0, maxX), camera.x));
    camera.y = Math.max(0, Math.min(Math.max(0, maxY), camera.y));
  }

  _updateHoverMouse(e) {
    const rect = this.game.canvas.getBoundingClientRect();
    this._updateHoverPx(e.clientX - rect.left, e.clientY - rect.top);
  }

  _updateHoverPx(sx, sy) {
    const { camera } = this.game;
    this.hx = Math.floor((sx + camera.x) / camera.zoom / TILE_SIZE);
    this.hy = Math.floor((sy + camera.y) / camera.zoom / TILE_SIZE);
  }

  // ─── Toast (mobile) ──────────────────────────────────────

  _showToast(msg, isError = false) {
    if (!IS_MOBILE()) return;
    this._mToast.textContent = msg;
    this._mToast.className = isError ? 'error visible' : 'visible';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this._mToast.classList.remove('visible'), 2500);
  }

  // ─── Periodic update ─────────────────────────────────────

  update() {
    const res = this.game.resources;
    const pop = this.game.inhabitants.filter(i => i.alive);
    const adults   = pop.filter(i => i.isAdult).length;
    const children = pop.length - adults;
    const popStr   = `👥 ${adults}${children > 0 ? `+${children}` : ''}`;

    const t      = this.game.time;
    const season = SEASONS[Math.floor(t / TICKS_PER_SEASON) % 4];
    const year   = Math.floor(t / TICKS_PER_YEAR) + 1;
    const timeStr = `An ${year} · ${season}`;

    // Desktop
    this._elWood.textContent = `🪵 ${Math.floor(res.wood)}`;
    this._elFood.textContent = `🌾 ${Math.floor(res.food)}`;
    this._elGold.textContent = `💰 ${Math.floor(res.gold)}`;
    this._elPop.textContent  = popStr;
    this._elTime.textContent = timeStr;

    // Mobile
    this._mWood.textContent = `🪵 ${Math.floor(res.wood)}`;
    this._mFood.textContent = `🌾 ${Math.floor(res.food)}`;
    this._mGold.textContent = `💰 ${Math.floor(res.gold)}`;
    this._mPop.textContent  = popStr;
    this._mTime.textContent = `An ${year}`;

    // Afford state (both sets of buttons)
    document.querySelectorAll('[data-type]').forEach(btn => {
      const def = BDEF[btn.dataset.type];
      if (!def) return;
      const ok = Object.entries(def.cost).every(([r, v]) => (res[r] || 0) >= v);
      btn.classList.toggle('cannot-afford', !ok);
    });
  }

  // ─── Notifications ───────────────────────────────────────

  pushLog(msg) {
    const li = document.createElement('li');
    li.textContent = msg;
    this._elLog.prepend(li);
    if (this._elLog.children.length > 8) this._elLog.removeChild(this._elLog.lastChild);
    this._showToast(msg);
  }

  showInfo(msg, isError = false) {
    this._elInfo.textContent = msg;
    this._showToast(msg, isError);
  }
}
