class Animal {
  constructor(type, enclosure) {
    this.type = type;
    this.enclosure = enclosure;
    this.colors = ANIMAL_COLORS[type];

    // Position: random inside enclosure with 1-tile margin
    const margin = TILE_SIZE;
    const ex = enclosure.x * TILE_SIZE + margin;
    const ey = enclosure.y * TILE_SIZE + margin;
    const ew = enclosure.w * TILE_SIZE - margin * 2;
    const eh = enclosure.h * TILE_SIZE - margin * 2;

    this.x = ex + Math.random() * ew;
    this.y = ey + Math.random() * eh;

    this.targetX = this.x;
    this.targetY = this.y;

    // Slow, natural movement speed (pixels per tick)
    this.speed = 0.3 + Math.random() * 0.2;
    this.state = 'wandering'; // 'wandering' | 'resting'
    this.restTimer = 0;
    this.restDuration = 0;

    // Random offset so not all animals sync their movement
    this._moveTimer = Math.floor(Math.random() * 120);
  }

  _pickNewTarget() {
    const margin = TILE_SIZE;
    const ex = this.enclosure.x * TILE_SIZE + margin;
    const ey = this.enclosure.y * TILE_SIZE + margin;
    const ew = this.enclosure.w * TILE_SIZE - margin * 2;
    const eh = this.enclosure.h * TILE_SIZE - margin * 2;

    this.targetX = ex + Math.random() * ew;
    this.targetY = ey + Math.random() * eh;
  }

  update() {
    if (this.state === 'resting') {
      this.restTimer++;
      if (this.restTimer >= this.restDuration) {
        this.state = 'wandering';
        this._pickNewTarget();
        this.restTimer = 0;
      }
      return;
    }

    // Wandering: move toward target slowly
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= this.speed + 0.5) {
      this.x = this.targetX;
      this.y = this.targetY;

      // Arrived: sometimes rest, sometimes pick new point
      if (Math.random() < 0.3) {
        this.state = 'resting';
        this.restDuration = 100 + Math.floor(Math.random() * 200);
        this.restTimer = 0;
      } else {
        this._pickNewTarget();
      }
    } else {
      this.x += (dx / dist) * this.speed;
      this.y += (dy / dist) * this.speed;
    }
  }
}
