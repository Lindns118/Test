class Enemy {
  constructor(type, x, y) {
    this.type = type;
    this.def  = ENEMY_DEFS[type];
    this.x    = x;
    this.y    = y;
    this.w    = this.def.w;
    this.h    = this.def.h;
    this.hp   = this.def.hp;
    this.vx   = this.def.speed * (Math.random() < 0.5 ? 1 : -1);
    this.vy   = 0;
    this.alive  = true;
    this.hurtTimer = 0;
    this.animTick  = 0;
    // Bird: position de vol de base
    this.baseY = y;
    this.flyPhase = Math.random() * Math.PI * 2;
    // Boss
    this.chargeTimer  = 0;
    this.chargeCooldown = 0;
    this.chargeDir = 1;
    this.phase2 = false; // boss: <6HP
  }

  update(level, player) {
    if (!this.alive) return;
    this.animTick++;
    if (this.hurtTimer > 0) this.hurtTimer--;

    if (this.def.flies) {
      this._updateBird();
    } else if (this.def.isBoss) {
      this._updateBoss(level, player);
    } else {
      this._updateWalker(level, player);
    }
  }

  _updateBird() {
    this.flyPhase += this.def.flySpeed;
    this.y = this.baseY + Math.sin(this.flyPhase) * this.def.flyAmplitude;
    this.x += this.vx;
    // Rebondit dans les limites génériques
    // (Le rebond est géré par le niveau dans game.js)
  }

  _updateWalker(level, player) {
    // Gravité
    this.vy += GRAVITY * 0.8;
    if (this.vy > MAX_FALL) this.vy = MAX_FALL;

    // Charge si dog et joueur proche
    if (this.def.chargeRange && this.chargeCooldown <= 0) {
      const dx = player.cx - (this.x + this.w/2);
      if (Math.abs(dx) < this.def.chargeRange) {
        this.vx = this.def.speed * 2 * (dx > 0 ? 1 : -1);
        this.chargeCooldown = 120;
      }
    }
    if (this.chargeCooldown > 0) this.chargeCooldown--;

    this.x += this.vx;
    this.y += this.vy;

    // Collision sol (platforms solides seulement)
    for (const p of level.platforms) {
      if (this._overlapAABB(p.x, p.y, p.w, p.h)) {
        if (this.vy > 0) {
          this.y = p.y - this.h;
          this.vy = 0;
          // Bord: retourner
          const nextX = this.x + this.vx * 8;
          if (nextX < p.x || nextX + this.w > p.x + p.w) {
            this.vx = -this.vx;
          }
        } else if (this.vy < 0) {
          this.y = p.y + p.h; this.vy = 0;
        }
        if (this.x < p.x) { this.x = p.x; this.vx = -this.vx; }
        if (this.x + this.w > p.x + p.w) { this.x = p.x + p.w - this.w; this.vx = -this.vx; }
      }
    }
    // Plateformes semi-solides
    for (const s of level.semis) {
      const prevBottom = this.y - this.vy + this.h;
      const curBottom  = this.y + this.h;
      if (this.vy > 0 && prevBottom <= s.y + 2 && curBottom >= s.y &&
          this.x + this.w > s.x && this.x < s.x + s.w) {
        this.y = s.y - this.h;
        this.vy = 0;
        // Bord: retourner
        const nextX = this.x + this.vx * 8;
        if (nextX < s.x || nextX + this.w > s.x + s.w) {
          this.vx = -this.vx;
        }
      }
    }
  }

  _updateBoss(level, player) {
    this._updateWalker(level, player);
    if (this.hp <= 6) this.phase2 = true;
    if (this.phase2) {
      // Phase 2: plus rapide + charge fréquente
      const dx = player.cx - (this.x + this.w/2);
      if (Math.abs(dx) < 500 && this.chargeCooldown <= 0) {
        this.vx = this.def.speed * 2.5 * (dx > 0 ? 1 : -1);
        this.chargeCooldown = 80;
      }
    }
  }

  takeHit(dmg) {
    this.hp -= dmg;
    this.hurtTimer = 20;
    if (this.hp <= 0) this.alive = false;
  }

  _overlapAABB(rx, ry, rw, rh) {
    return this.x < rx + rw && this.x + this.w > rx &&
           this.y < ry + rh && this.y + this.h > ry;
  }
}
