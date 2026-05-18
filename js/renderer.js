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
    this._drawVisitors();
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

        // Base grass (always drawn first)
        ctx.fillStyle = GRASS_COLORS[map.grassVariant(x, y)];
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

        if (tile === TILE.PATH) {
          this._drawPath(px, py, x, y);
        } else if (tile === TILE.TREE) {
          this._drawTree(px, py);
        } else if (tile === TILE.WATER) {
          this._drawWater(px, py, x, y);
        }
      }
    }
  }

  _drawPath(px, py, tx, ty) {
    const ctx = this.ctx;

    // Beige/stone base
    ctx.fillStyle = '#c8b890';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

    // Subtle paving lines (grid effect)
    ctx.strokeStyle = 'rgba(160,140,100,0.5)';
    ctx.lineWidth = 0.5;

    // Vertical divider
    ctx.beginPath();
    ctx.moveTo(px + TILE_SIZE / 2, py);
    ctx.lineTo(px + TILE_SIZE / 2, py + TILE_SIZE);
    ctx.stroke();

    // Horizontal divider
    ctx.beginPath();
    ctx.moveTo(px, py + TILE_SIZE / 2);
    ctx.lineTo(px + TILE_SIZE, py + TILE_SIZE / 2);
    ctx.stroke();

    // Border (slightly darker)
    ctx.strokeStyle = 'rgba(140,120,80,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
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

  _drawBuildings() {
    const { ctx, game } = this;

    for (const b of game.buildings) {
      const px = b.x * TILE_SIZE;
      const py = b.y * TILE_SIZE;
      const bw = b.w * TILE_SIZE;
      const bh = b.h * TILE_SIZE;

      if (b.def.isEnclosure) {
        this._drawEnclosure(ctx, b, px, py, bw, bh);
      } else {
        this._drawNormalBuilding(ctx, b, px, py, bw, bh);
      }
    }
  }

  _drawEnclosure(ctx, b, px, py, bw, bh) {
    const def = b.def;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(px + 3, py + 3, bw, bh);

    // Enclosure ground (colored)
    ctx.fillStyle = def.color;
    ctx.fillRect(px, py, bw, bh);

    // Inner ground texture (lighter)
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(px + 4, py + 4, bw - 8, bh - 8);

    // Fence: horizontal rails top and bottom
    ctx.fillStyle = def.fenceColor;
    ctx.fillRect(px, py, bw, 4);
    ctx.fillRect(px, py + bh - 4, bw, 4);
    ctx.fillRect(px, py, 4, bh);
    ctx.fillRect(px + bw - 4, py, 4, bh);

    // Fence posts every 32px on perimeter
    ctx.fillStyle = def.fenceColor;
    const postSize = 6;
    // Top and bottom rails: posts
    for (let fx = px; fx <= px + bw; fx += TILE_SIZE) {
      ctx.fillRect(fx - postSize / 2, py - 1, postSize, 6);
      ctx.fillRect(fx - postSize / 2, py + bh - 5, postSize, 6);
    }
    // Left and right rails: posts
    for (let fy = py; fy <= py + bh; fy += TILE_SIZE) {
      ctx.fillRect(px - 1, fy - postSize / 2, 6, postSize);
      ctx.fillRect(px + bw - 5, fy - postSize / 2, 6, postSize);
    }

    // Horizontal mid-rail lines
    ctx.fillStyle = def.fenceColor;
    ctx.fillRect(px, py + Math.floor(bh * 0.33), bw, 2);
    ctx.fillRect(px, py + Math.floor(bh * 0.66), bw, 2);
    ctx.fillRect(px + Math.floor(bw * 0.33), py, 2, bh);
    ctx.fillRect(px + Math.floor(bw * 0.66), py, 2, bh);

    // Icon + name at center
    const cx = px + bw / 2;
    const cy = py + bh / 2;

    ctx.font = `${Math.min(bw, bh) * 0.35}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, cx, cy - 6);

    ctx.font = `bold ${Math.min(10, bw * 0.1 + 6)}px sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(def.name, cx, cy + bh * 0.22);

    // Draw animals
    for (const animal of b.animals) {
      this._drawAnimal(ctx, animal);
    }
  }

  _drawAnimal(ctx, animal) {
    const { x, y, colors, type } = animal;
    const r = 5;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(x + 1, y + r * 0.5 + 1, r * 1.1, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = colors.body;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Type-specific detail
    if (type === 'lion' && colors.mane) {
      ctx.fillStyle = colors.mane;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'penguin' && colors.belly) {
      ctx.fillStyle = colors.belly;
      ctx.beginPath();
      ctx.ellipse(x, y + 1, r * 0.45, r * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'zebra' && colors.stripe) {
      // Stripes
      ctx.strokeStyle = colors.stripe;
      ctx.lineWidth = 1;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * 2 - 1, y - r);
        ctx.lineTo(x + i * 2 + 1, y + r);
        ctx.stroke();
      }
    } else if (type === 'bird' && colors.wing) {
      ctx.fillStyle = colors.wing;
      ctx.beginPath();
      ctx.arc(x - 2, y - 2, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'monkey' && colors.face) {
      ctx.fillStyle = colors.face;
      ctx.beginPath();
      ctx.arc(x, y - 1, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawNormalBuilding(ctx, b, px, py, bw, bh) {
    const def = b.def;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(px + 4, py + 4, bw, bh);

    // Main wall
    ctx.fillStyle = def.color || '#888';
    ctx.fillRect(px, py, bw, bh);

    // Roof
    if (def.roofColor) {
      ctx.fillStyle = def.roofColor;
      ctx.fillRect(px, py, bw, Math.round(bh * 0.38));

      // Roof ridge line
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(px + 2, py + Math.round(bh * 0.38) - 2, bw - 4, 2);
    }

    // Windows (only for larger buildings)
    if (bw >= 64 && def.roofColor) {
      ctx.fillStyle = '#c8e4ff';
      const wpy = py + Math.round(bh * 0.48);
      ctx.fillRect(px + 5, wpy, 8, 7);
      ctx.fillRect(px + bw - 13, wpy, 8, 7);
      // Window cross
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(px + 9, wpy, 1, 7);
      ctx.fillRect(px + 5, wpy + 3, 8, 1);
      ctx.fillRect(px + bw - 9, wpy, 1, 7);
      ctx.fillRect(px + bw - 13, wpy + 3, 8, 1);
    } else if (def.roofColor) {
      ctx.fillStyle = '#c8e4ff';
      const wpy = py + Math.round(bh * 0.48);
      ctx.fillRect(px + 5, wpy, 7, 6);
    }

    // Door
    if (def.roofColor) {
      ctx.fillStyle = '#3a2010';
      const dw = 7, dh = 11;
      ctx.fillRect(px + bw / 2 - dw / 2, py + bh - dh, dw, dh);
    }

    // Building icon centered
    ctx.font = `${Math.min(bw, bh) * 0.4}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, px + bw / 2, py + bh / 2 - 4);

    // Building name
    ctx.font = `bold ${bw >= 64 ? 10 : 9}px sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'center';
    ctx.fillText(def.name, px + bw / 2, py + bh - 3);
  }

  _drawVisitors() {
    const { ctx, game } = this;

    for (const v of game.visitors) {
      if (!v.alive) continue;

      const r = 5;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(v.x + 1, v.y + r + 1, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.fillStyle = v.color;
      ctx.beginPath();
      ctx.arc(v.x, v.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.38)';
      ctx.beginPath();
      ctx.arc(v.x - r * 0.28, v.y - r * 0.28, r * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Low energy warning dot
      if (v.energy < 20) {
        ctx.fillStyle = '#ff4040';
        ctx.beginPath();
        ctx.arc(v.x + r, v.y - r, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Watching indicator
      if (v.state === 'watching') {
        ctx.fillStyle = '#ffe040';
        ctx.beginPath();
        ctx.arc(v.x, v.y - r - 4, 3, 0, Math.PI * 2);
        ctx.fill();
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

    // Show icon in ghost
    ctx.font = `${Math.min(bw, bh) * 0.4}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, px + bw / 2, py + bh / 2);
  }
}
