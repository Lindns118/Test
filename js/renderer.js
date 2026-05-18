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
    this._drawEmployees();
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
    const { x, y, type } = animal;
    const c = animal.colors;

    ctx.save();

    if (type === 'lion') {
      // Mane
      ctx.fillStyle = c.mane || '#8B4513';
      ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI*2); ctx.fill();
      // Body
      ctx.fillStyle = c.body;
      ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI*2); ctx.fill();
      // Ears
      ctx.fillStyle = c.body;
      ctx.beginPath(); ctx.arc(x-4, y-6, 2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+4, y-6, 2, 0, Math.PI*2); ctx.fill();
      // Tail
      ctx.strokeStyle = c.mane || '#8B4513'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x+5, y+3); ctx.quadraticCurveTo(x+10, y+6, x+9, y+1); ctx.stroke();

    } else if (type === 'elephant') {
      // Ear (left, large)
      ctx.fillStyle = c.ear || '#707078';
      ctx.beginPath(); ctx.ellipse(x-8, y-1, 5, 6, -0.3, 0, Math.PI*2); ctx.fill();
      // Body
      ctx.fillStyle = c.body;
      ctx.beginPath(); ctx.ellipse(x, y+2, 8, 6, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.beginPath(); ctx.arc(x+2, y-5, 5, 0, Math.PI*2); ctx.fill();
      // Trunk
      ctx.strokeStyle = c.body; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x+5, y-3); ctx.quadraticCurveTo(x+11, y+2, x+8, y+7); ctx.stroke();
      // Tusk
      ctx.strokeStyle = '#fffff0'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x+6, y-4); ctx.lineTo(x+10, y-3); ctx.stroke();
      // Eye
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x+4, y-6, 1.2, 0, Math.PI*2); ctx.fill();

    } else if (type === 'giraffe') {
      // Body
      ctx.fillStyle = c.body;
      ctx.beginPath(); ctx.ellipse(x, y+5, 5, 4, 0, 0, Math.PI*2); ctx.fill();
      // Neck
      ctx.fillRect(x-2, y-6, 4, 12);
      // Head
      ctx.beginPath(); ctx.arc(x, y-8, 3.5, 0, Math.PI*2); ctx.fill();
      // Snout
      ctx.beginPath(); ctx.ellipse(x+1, y-6, 2, 1.5, 0.5, 0, Math.PI*2); ctx.fill();
      // Spots
      ctx.fillStyle = c.spot || '#a07020';
      [[x-1,y+5],[x+2,y+2],[x-2,y+1],[x,y-3]].forEach(([sx,sy]) => {
        ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI*2); ctx.fill();
      });
      // Ossicones
      ctx.strokeStyle = c.spot || '#a07020'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x-2, y-10); ctx.lineTo(x-2, y-13); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+2, y-10); ctx.lineTo(x+2, y-13); ctx.stroke();

    } else if (type === 'penguin') {
      // Body
      ctx.fillStyle = c.body;
      ctx.beginPath(); ctx.ellipse(x, y, 5, 6.5, 0, 0, Math.PI*2); ctx.fill();
      // Belly
      ctx.fillStyle = c.belly || '#f0f0f0';
      ctx.beginPath(); ctx.ellipse(x, y+1, 3, 5, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = c.body;
      ctx.beginPath(); ctx.arc(x, y-6, 4, 0, Math.PI*2); ctx.fill();
      // Beak
      ctx.fillStyle = '#FF8800';
      ctx.beginPath(); ctx.moveTo(x-2, y-6); ctx.lineTo(x+2, y-6); ctx.lineTo(x, y-4); ctx.fill();
      // Eyes
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x-2, y-7, 1.2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x-1.5, y-7, 0.7, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x+2, y-7, 1.2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x+2.5, y-7, 0.7, 0, Math.PI*2); ctx.fill();
      // Wing
      ctx.fillStyle = c.body;
      ctx.beginPath(); ctx.ellipse(x-5, y, 2, 5, -0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x+5, y, 2, 5, 0.3, 0, Math.PI*2); ctx.fill();

    } else if (type === 'monkey') {
      // Tail
      ctx.strokeStyle = c.body; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x+4, y+5); ctx.quadraticCurveTo(x+10, y+7, x+9, y+2); ctx.stroke();
      // Body
      ctx.fillStyle = c.body;
      ctx.beginPath(); ctx.arc(x, y+3, 4.5, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.beginPath(); ctx.arc(x, y-2, 5, 0, Math.PI*2); ctx.fill();
      // Face
      ctx.fillStyle = c.face || '#c07848';
      ctx.beginPath(); ctx.ellipse(x, y-1.5, 3.5, 3, 0, 0, Math.PI*2); ctx.fill();
      // Eyes
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(x-2, y-3, 1, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+2, y-3, 1, 0, Math.PI*2); ctx.fill();
      // Ears
      ctx.fillStyle = c.face || '#c07848';
      ctx.beginPath(); ctx.arc(x-5, y-2, 2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+5, y-2, 2, 0, Math.PI*2); ctx.fill();

    } else if (type === 'zebra') {
      // Body
      ctx.fillStyle = c.body;
      ctx.beginPath(); ctx.ellipse(x, y+2, 6.5, 5, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.beginPath(); ctx.ellipse(x+7, y-1, 4, 3, 0.4, 0, Math.PI*2); ctx.fill();
      // Mane
      ctx.strokeStyle = c.stripe || '#202020'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x+3, y-3); ctx.lineTo(x+8, y-4); ctx.stroke();
      // Stripes on body
      ctx.strokeStyle = c.stripe || '#202020'; ctx.lineWidth = 1.8;
      [[-4,y-3,-5,y+6],[-1,y-4,-2,y+6],[2,y-3,1,y+6],[5,y-1,4,y+5]].forEach(([x1,y1,x2,y2]) => {
        ctx.beginPath(); ctx.moveTo(x+x1, y1); ctx.lineTo(x+x2, y2); ctx.stroke();
      });
      // Stripe on head
      ctx.beginPath(); ctx.moveTo(x+6, y-4); ctx.lineTo(x+7, y+1); ctx.stroke();
      // Eye
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x+9, y-2, 1, 0, Math.PI*2); ctx.fill();
      // Ears
      ctx.fillStyle = c.body;
      ctx.beginPath(); ctx.arc(x+6, y-4, 1.5, 0, Math.PI*2); ctx.fill();

    } else if (type === 'bird') {
      // Wing spread
      ctx.fillStyle = c.wing || '#f0d020';
      ctx.beginPath(); ctx.ellipse(x-4, y, 5, 2.5, -0.4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x+4, y, 5, 2.5, 0.4, 0, Math.PI*2); ctx.fill();
      // Body
      ctx.fillStyle = c.body;
      ctx.beginPath(); ctx.ellipse(x, y+1, 4, 3.5, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.beginPath(); ctx.arc(x, y-3, 3, 0, Math.PI*2); ctx.fill();
      // Beak
      ctx.fillStyle = '#e0b000';
      ctx.beginPath(); ctx.moveTo(x-1, y-3); ctx.lineTo(x+1, y-3); ctx.lineTo(x, y-1); ctx.fill();
      // Eye
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x+1.5, y-3.5, 1.2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x+1.8, y-3.5, 0.7, 0, Math.PI*2); ctx.fill();
      // Tail
      ctx.fillStyle = c.body;
      ctx.beginPath(); ctx.moveTo(x-2, y+4); ctx.lineTo(x+2, y+4); ctx.lineTo(x, y+7); ctx.fill();
    }

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath(); ctx.arc(x-2, y-3, 2.5, 0, Math.PI*2); ctx.fill();

    ctx.restore();
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
    const t = game.time;

    for (const v of game.visitors) {
      if (!v.alive) continue;

      ctx.save();

      const moving = v.state === 'going' || v.state === 'leaving';
      const walk = moving ? Math.sin(t * 0.2 + v.id * 1.7) * 2.5 : 0;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(v.x + 1, v.y + 10, 4, 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Legs
      ctx.strokeStyle = v.color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(v.x, v.y + 4); ctx.lineTo(v.x - 2 + walk, v.y + 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(v.x, v.y + 4); ctx.lineTo(v.x + 2 - walk, v.y + 10); ctx.stroke();

      // Body
      ctx.fillStyle = v.color;
      ctx.beginPath();
      ctx.ellipse(v.x, v.y + 1, 3.5, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Arms
      ctx.strokeStyle = v.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(v.x - 3, v.y - 1); ctx.lineTo(v.x - 5.5, v.y + 3 + walk * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(v.x + 3, v.y - 1); ctx.lineTo(v.x + 5.5, v.y + 3 - walk * 0.5); ctx.stroke();

      // Head (skin)
      ctx.fillStyle = '#f5d08a';
      ctx.beginPath(); ctx.arc(v.x, v.y - 5, 4, 0, Math.PI * 2); ctx.fill();

      // Hat (tiny, colored)
      ctx.fillStyle = v.color;
      ctx.fillRect(v.x - 3, v.y - 11, 6, 3);
      ctx.fillRect(v.x - 4, v.y - 9, 8, 1.5);

      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.arc(v.x - 1.5, v.y - 6.5, 1.5, 0, Math.PI * 2); ctx.fill();

      // Watching star
      if (v.state === 'watching') {
        ctx.fillStyle = '#ffe040';
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', v.x, v.y - 17);
      }

      // Low energy warning
      if (v.energy < 20) {
        ctx.fillStyle = '#ff4040';
        ctx.beginPath(); ctx.arc(v.x + 5, v.y - 9, 2.5, 0, Math.PI * 2); ctx.fill();
      }

      ctx.restore();
    }
  }

  _drawEmployees() {
    const { ctx, game } = this;
    const t = game.time;

    for (const emp of game.employees) {
      ctx.save();

      const moving = emp.state === 'going' || emp.state === 'back';
      const walk = moving ? Math.sin(t * 0.18 + emp.id * 2.1) * 2 : 0;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(emp.x + 1, emp.y + 10, 4, 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Legs
      ctx.strokeStyle = '#333'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(emp.x, emp.y + 4); ctx.lineTo(emp.x - 2 + walk, emp.y + 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(emp.x, emp.y + 4); ctx.lineTo(emp.x + 2 - walk, emp.y + 10); ctx.stroke();

      // Body (shirt)
      ctx.fillStyle = emp.colors.shirt;
      ctx.beginPath();
      ctx.ellipse(emp.x, emp.y + 1, 3.5, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Arms
      ctx.strokeStyle = emp.colors.shirt; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(emp.x - 3, emp.y - 1); ctx.lineTo(emp.x - 5.5, emp.y + 3 + walk * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(emp.x + 3, emp.y - 1); ctx.lineTo(emp.x + 5.5, emp.y + 3 - walk * 0.5); ctx.stroke();

      // Head
      ctx.fillStyle = '#f5d08a';
      ctx.beginPath(); ctx.arc(emp.x, emp.y - 5, 4, 0, Math.PI * 2); ctx.fill();

      // Hard hat (keeper) or cap (cleaner)
      ctx.fillStyle = emp.colors.hat;
      if (emp.type === 'keeper') {
        ctx.beginPath(); ctx.arc(emp.x, emp.y - 9, 4.5, Math.PI, 0); ctx.fill();
        ctx.fillRect(emp.x - 5, emp.y - 9, 10, 2);
      } else {
        ctx.fillRect(emp.x - 4, emp.y - 10, 8, 3);
        ctx.fillRect(emp.x - 5, emp.y - 8, 10, 1.5);
      }

      // Working indicator
      if (emp.state === 'working') {
        ctx.fillStyle = '#fff';
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emp.type === 'keeper' ? '🔧' : '🧹', emp.x, emp.y - 17);
      }

      ctx.restore();
    }
  }

  _drawGhost() {
    const { ctx, game } = this;
    const { selectedBuildType, movingBuilding, hx, hy } = game.ui;
    const ghostType = selectedBuildType || (movingBuilding ? movingBuilding.type : null);

    // Highlight hovered building when idle (no selection, no move)
    if (!ghostType && hx >= 0) {
      const hovered = game.buildings.find(b =>
        b.type !== 'entrance' &&
        hx >= b.x && hx < b.x + b.w &&
        hy >= b.y && hy < b.y + b.h
      );
      if (hovered) {
        ctx.strokeStyle = 'rgba(255,255,100,0.75)';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(hovered.x * TILE_SIZE, hovered.y * TILE_SIZE, hovered.w * TILE_SIZE, hovered.h * TILE_SIZE);
        ctx.setLineDash([]);
      }
      return;
    }

    if (!ghostType || hx < 0) return;

    const excludeId = movingBuilding ? movingBuilding.id : null;
    const def = BDEF[ghostType];
    const canPlace = game.canPlaceBuilding(ghostType, hx, hy, excludeId);
    const px = hx * TILE_SIZE, py = hy * TILE_SIZE;
    const bw = def.w * TILE_SIZE, bh = def.h * TILE_SIZE;

    ctx.fillStyle = canPlace ? 'rgba(80,200,80,0.35)' : 'rgba(200,60,60,0.35)';
    ctx.fillRect(px, py, bw, bh);

    ctx.strokeStyle = canPlace ? '#50e050' : '#e05050';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(px, py, bw, bh);
    ctx.setLineDash([]);

    ctx.font = `${Math.min(bw, bh) * 0.4}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, px + bw / 2, py + bh / 2);
  }
}
