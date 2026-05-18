function findPath(game, sx, sy, tx, ty) {
  if (sx === tx && sy === ty) return [];

  const manhattan = Math.abs(tx - sx) + Math.abs(ty - sy);
  if (manhattan > 80) {
    return [{ x: tx, y: ty }];
  }

  const key = (x, y) => x * 256 + y;
  const open = new Map();
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();

  const h = (x, y) => Math.abs(x - tx) + Math.abs(y - ty);
  const sk = key(sx, sy);

  gScore.set(sk, 0);
  fScore.set(sk, h(sx, sy));
  open.set(sk, { x: sx, y: sy, f: h(sx, sy) });

  const DIRS = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
    { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
  ];

  let iterations = 0;
  const MAX_ITER = 400;

  while (open.size > 0 && iterations++ < MAX_ITER) {
    let current = null;
    let lowestF = Infinity;
    for (const [, node] of open) {
      if (node.f < lowestF) { lowestF = node.f; current = node; }
    }
    if (!current) break;

    const ck = key(current.x, current.y);

    if (current.x === tx && current.y === ty) {
      const path = [];
      let k = ck;
      while (cameFrom.has(k)) {
        const [px, py] = [Math.floor(k / 256), k % 256];
        path.unshift({ x: px, y: py });
        k = cameFrom.get(k);
      }
      return path;
    }

    open.delete(ck);

    for (const { dx, dy } of DIRS) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const nk = key(nx, ny);

      if (!isWalkableForPath(game, nx, ny, tx, ty)) continue;

      const tentG = (gScore.get(ck) || 0) + 1;
      if (tentG >= (gScore.get(nk) ?? Infinity)) continue;

      cameFrom.set(nk, ck);
      gScore.set(nk, tentG);
      const f = tentG + h(nx, ny);
      fScore.set(nk, f);
      open.set(nk, { x: nx, y: ny, f });
    }
  }

  return [{ x: tx, y: ty }];
}

function isWalkableForPath(game, x, y, tx, ty) {
  if (!game.map.inBounds(x, y)) return false;
  if (!game.map.isWalkable(x, y)) return false;
  if (x === tx && y === ty) return true;
  for (const b of game.buildings) {
    if (b.occupies(x, y)) return false;
  }
  return true;
}

// Weighted A* for visitors: PATH tiles cost 1, GRASS cost 3, WATER/TREE/building = blocked
function findPathWeighted(game, sx, sy, tx, ty) {
  if (sx === tx && sy === ty) return [];

  const manhattan = Math.abs(tx - sx) + Math.abs(ty - sy);
  if (manhattan > 120) {
    return [{ x: tx, y: ty }];
  }

  const key = (x, y) => x * 256 + y;
  const open = new Map();
  const cameFrom = new Map();
  const gScore = new Map();

  const h = (x, y) => Math.abs(x - tx) + Math.abs(y - ty);
  const sk = key(sx, sy);

  gScore.set(sk, 0);
  open.set(sk, { x: sx, y: sy, f: h(sx, sy) });

  const DIRS = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
    { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
  ];

  let iterations = 0;
  const MAX_ITER = 800;

  while (open.size > 0 && iterations++ < MAX_ITER) {
    let current = null;
    let lowestF = Infinity;
    for (const [, node] of open) {
      if (node.f < lowestF) { lowestF = node.f; current = node; }
    }
    if (!current) break;

    const ck = key(current.x, current.y);

    if (current.x === tx && current.y === ty) {
      const path = [];
      let k = ck;
      while (cameFrom.has(k)) {
        const [px, py] = [Math.floor(k / 256), k % 256];
        path.unshift({ x: px, y: py });
        k = cameFrom.get(k);
      }
      return path;
    }

    open.delete(ck);

    for (const { dx, dy } of DIRS) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const nk = key(nx, ny);

      if (!game.map.inBounds(nx, ny)) continue;

      const tile = game.map.getTile(nx, ny);

      // Blocked tiles
      if (tile === TILE.WATER || tile === TILE.TREE) continue;

      // Check buildings (unless it's the target, which might be the entrance)
      if (nx !== tx || ny !== ty) {
        let blocked = false;
        for (const b of game.buildings) {
          if (!b.def.isEnclosure && !b.def.isPath && b.type !== 'entrance' && b.type !== 'bench' && b.type !== 'toilets') {
            if (b.occupies(nx, ny)) { blocked = true; break; }
          }
        }
        if (blocked) continue;
      }

      // Cost: PATH = 1, GRASS = 3
      const stepCost = (tile === TILE.PATH) ? 1 : 3;
      const tentG = (gScore.get(ck) || 0) + stepCost;
      if (tentG >= (gScore.get(nk) ?? Infinity)) continue;

      cameFrom.set(nk, ck);
      gScore.set(nk, tentG);
      const f = tentG + h(nx, ny);
      open.set(nk, { x: nx, y: ny, f });
    }
  }

  // Fallback: direct step
  return [{ x: tx, y: ty }];
}
