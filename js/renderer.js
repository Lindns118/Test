class Renderer {
  constructor(game) {
    this.game = game;
    this.canvas = game.canvas;
    this.ctx = game.ctx;
    this._waterPhase = 0;
  }

  render() {
    const { ctx, canvas, game } = this;
    const { camera } = game;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this._waterPhase = (this._waterPhase + 0.02) % (Math.PI * 2);

    ctx.setTransform(camera.zoom, 0, 0, camera.zoom, -camera.x, -camera.y);

    this._drawMap();
    this._drawBuildings();
    this._drawInhabitants();
    this._drawGhost();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  _visibleTileRange() {
    const { canvas, game: { camera } } = this;
    const wx0 = camera.x / camera.zoom;
    const wy0 = camera.y / camera.zoom;
    const wx1 = (camera.x + canvas.width) / camera.zoom;
    const wy1 = (camera.y + canvas.height) / camera.zoom;

    return {
      x0: Math.max(0, Math.floor(wx0 / TILE_SIZE) - 1),
      y0: Math.max(0, Math.floor(wy0 / TILE_SIZE) - 1),
      x1: Math.min(MAP_W, Math.ceil(wx1 / TILE_SIZE) + 1),
      y1: Math.min(MAP_H, Math.ceil(wy1 / TILE_SIZE) + 1),
    };
  }

  _drawMap() {
    const { ctx, game } = this;
    const map = game.map;
    const { x0, y0, x1, y1 } = this._visibleTileRange();

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        const tile = map.getTile(x, y);

        ctx.fillStyle = GRASS_COLORS[map.grassVariant(x, y)];
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

        if (tile === TILE.TREE) {
          this._drawTree(px, py);
        } else if (tile === TILE.WATER) {
          this._drawWater(px, py, x, y);
        } else if (tile === TILE.ROCK) {
          this._drawRock(px, py);
        }
      }
    }
  }

  _drawTree(px, py) {
    const ctx = this.ctx;
    const cx = px + TILE_SIZE / 2;
    const cy = py + TILE_SIZE / 2;

    // Trunk
    ctx.fillStyle = '#5a3318';
    ctx.fillRect(cx - 3, cy + 2, 6, TILE_SIZE / 2 - 2);

    // Shadow canopy
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.arc(cx + 2, cy + 2, 10, 0, Math.PI * 2);
    ctx.fill();

    // Dark base
    ctx.fillStyle = '#1e4010';
    ctx.beginPath();
    ctx.arc(cx, cy + 1, 10, 0, Math.PI * 2);
    ctx.fill();

    // Main canopy
    ctx.fillStyle = '#2d5a18';
    ctx.beginPath();
    ctx.arc(cx, cy - 1, 10, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = '#427a22';
    ctx.beginPath();
    ctx.arc(cx - 2, cy - 3, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawWater(px, py, tx, ty) {
    const ctx = this.ctx;
    const shimmer = 0.12 + 0.06 * Math.sin(this._waterPhase + tx * 0.5 + ty * 0.3);

    ctx.fillStyle = '#3a88bb';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

    ctx.fillStyle = `rgba(180,230,255,${shimmer})`;
    ctx.fillRect(px + 3, py + 6, 10, 2);
    ctx.fillRect(px + 18, py + 14, 8, 2);
    ctx.fillRect(px + 8, py + 22, 12, 2);
  }

  _drawRock(px, py) {
    const ctx = this.ctx;
    ctx.fillStyle = '#6a6a6a';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(px + TILE_SIZE / 2 - 2, py + TILE_SIZE / 2 - 2, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#aaa';
    ctx.beginPath();
    ctx.arc(px + TILE_SIZE / 2 - 4, py + TILE_SIZE / 2 - 4, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawBuildings() {
    const { ctx, game } = this;

    for (const b of game.buildings) {
      const px = b.x * TILE_SIZE;
      const py = b.y * TILE_SIZE;
      const bw = b.w * TILE_SIZE;
      const bh = b.h * TILE_SIZE;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(px + 4, py + 4, bw, bh);

      // Main wall
      ctx.fillStyle = b.def.color;
      ctx.fillRect(px, py, bw, bh);

      // Roof
      ctx.fillStyle = b.def.roofColor;
      ctx.fillRect(px, py, bw, Math.round(bh * 0.38));

      // Roof ridge line
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(px + 2, py + Math.round(bh * 0.38) - 2, bw - 4, 2);

      // Windows
      ctx.fillStyle = '#c8e4ff';
      const wpy = py + Math.round(bh * 0.48);
      if (bw >= 64) {
        ctx.fillRect(px + 5, wpy, 8, 7);
        ctx.fillRect(px + bw - 13, wpy, 8, 7);
        // Window cross
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(px + 9, wpy, 1, 7);
        ctx.fillRect(px + 5, wpy + 3, 8, 1);
        ctx.fillRect(px + bw - 9, wpy, 1, 7);
        ctx.fillRect(px + bw - 13, wpy + 3, 8, 1);
      } else {
        ctx.fillStyle = '#c8e4ff';
        ctx.fillRect(px + 5, wpy, 7, 6);
      }

      // Door
      ctx.fillStyle = '#3a2010';
      const dw = 7, dh = 11;
      ctx.fillRect(px + bw / 2 - dw / 2, py + bh - dh, dw, dh);

      // Building name
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `bold ${bw >= 64 ? 10 : 9}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(b.def.name, px + bw / 2, py + bh / 2 + 4);

      // Worker indicator
      if (b.def.workers_needed > 0) {
        const filled = b.workers.length;
        const total = b.def.workers_needed;
        ctx.fillStyle = filled === total ? '#50e050' : filled > 0 ? '#f0a030' : '#f04040';
        ctx.font = '8px sans-serif';
        ctx.fillText(`${filled}/${total}`, px + bw / 2, py + bh - 3);

        // Red border if inactive
        if (!b.active) {
          ctx.strokeStyle = 'rgba(255,60,60,0.7)';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 1, py + 1, bw - 2, bh - 2);
        }
      }

      // House: resident count
      if (b.isHouse) {
        const res = b.residents.length;
        const cap = b.def.capacity;
        ctx.fillStyle = res >= cap ? '#f0a030' : '#50e050';
        ctx.font = '8px sans-serif';
        ctx.fillText(`${res}/${cap}`, px + bw / 2, py + bh - 3);
      }
    }
  }

  _drawInhabitants() {
    const { ctx, game } = this;

    for (const inh of game.inhabitants) {
      if (!inh.alive) continue;

      const r = inh.isAdult ? 6 : 4;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(inh.x + 1, inh.y + r + 1, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.fillStyle = inh.color;
      ctx.beginPath();
      ctx.arc(inh.x, inh.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.38)';
      ctx.beginPath();
      ctx.arc(inh.x - r * 0.28, inh.y - r * 0.28, r * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Couple dot (pink)
      if (inh.partner) {
        ctx.fillStyle = '#ff80c0';
        ctx.beginPath();
        ctx.arc(inh.x + r, inh.y - r, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Hunger warning
      if (inh.hunger < 25) {
        ctx.fillStyle = '#ff3300';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', inh.x, inh.y - r - 2);
      }
    }
  }

  _drawGhost() {
    const { ctx, game } = this;
    const { selectedBuildType, hx, hy } = game.ui;
    if (!selectedBuildType || hx < 0) return;

    const def = BDEF[selectedBuildType];
    const canPlace = game.canPlaceBuilding(selectedBuildType, hx, hy);
    const px = hx * TILE_SIZE, py = hy * TILE_SIZE;
    const bw = def.w * TILE_SIZE, bh = def.h * TILE_SIZE;

    ctx.fillStyle = canPlace ? 'rgba(80,200,80,0.35)' : 'rgba(200,60,60,0.35)';
    ctx.fillRect(px, py, bw, bh);

    ctx.strokeStyle = canPlace ? '#50e050' : '#e05050';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(px, py, bw, bh);
    ctx.setLineDash([]);
  }
}
