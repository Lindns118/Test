class Player {
  constructor(x, y) {
    this.x = x; // position pixel (coin haut-gauche)
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facingRight = true;

    this.lives = 3;
    this.score = 0;
    this.totalFish = 0;
    this.evolution = 0; // 0, 1, 2
    this.invincible = 0; // timer ticks d'invincibilité
    this.hurtTimer = 0;

    this.attackTimer = 0;    // >0 = en train d'attaquer
    this.attackCooldown = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.doubleJumpUsed = false;

    this.animTick = 0;
    this.dead = false;
    this.won = false;
    this.evolutionBoost = 0; // frames of temporary +1 evolution (mushroom)
    this.bootTimer = 0;      // frames of spike immunity (boot power-up)
  }

  get stage() {
    const evo = Math.min(2, this.evolution + (this.evolutionBoost > 0 ? 1 : 0));
    return CAT_STAGES[evo];
  }
  get w()     { return CAT_STAGES[this.evolution].w; }
  get h()     { return CAT_STAGES[this.evolution].h; }
  get cx()    { return this.x + this.w / 2; }
  get cy()    { return this.y + this.h / 2; }

  update(input, level) {
    if (this.dead) return;
    this.animTick++;
    if (this.invincible > 0) this.invincible--;
    if (this.hurtTimer > 0) this.hurtTimer--;
    if (this.evolutionBoost > 0) this.evolutionBoost--;
    if (this.bootTimer > 0) this.bootTimer--;
    if (this.attackTimer > 0) this.attackTimer--;
    if (this.attackCooldown > 0) this.attackCooldown--;
    if (this.dashTimer > 0) this.dashTimer--;
    if (this.dashCooldown > 0) this.dashCooldown--;

    const st = this.stage;

    // ── Dash ──
    if (this.dashTimer > 0) {
      this.vx = this.facingRight ? st.speed * 2.2 : -st.speed * 2.2;
    } else {
      // ── Déplacement horizontal ──
      if (input.left)  { this.vx = -st.speed; this.facingRight = false; }
      else if (input.right) { this.vx = st.speed;  this.facingRight = true;  }
      else this.vx *= 0.7;
    }

    // ── Saut ──
    if (input.jumpPressed) {
      if (this.onGround) {
        this.vy = st.jumpForce;
        this.onGround = false;
        this.doubleJumpUsed = false;
      } else if (st.canDoubleJump && !this.doubleJumpUsed) {
        this.vy = st.jumpForce * 0.85;
        this.doubleJumpUsed = true;
      }
    }

    // ── Dash (déclencher) ──
    if (input.dashPressed && st.canDash && this.dashTimer <= 0 && this.dashCooldown <= 0) {
      this.dashTimer = 14;
      this.dashCooldown = 45;
    }

    // ── Attaque ──
    if (input.attackPressed && this.attackTimer <= 0 && this.attackCooldown <= 0) {
      this.attackTimer = 16;
      this.attackCooldown = 28;
    }

    // ── Gravité ──
    this.vy += GRAVITY;
    if (this.vy > MAX_FALL) this.vy = MAX_FALL;

    // ── Collision (horizontal puis vertical) ──
    this.x += this.vx;
    this._resolveHorizontal(level);

    this.onGround = false;
    this.y += this.vy;
    this._resolveVertical(level);

    // Limites gauche
    if (this.x < 0) { this.x = 0; this.vx = 0; }
    // Limite droite
    if (this.x + this.w > level.width) { this.x = level.width - this.w; this.vx = 0; }

    // Évolution
    this._checkEvolution();
  }

  _resolveHorizontal(level) {
    for (const p of level.platforms) {
      if (this._overlapAABB(p.x, p.y, p.w, p.h)) {
        if (this.vx > 0) { this.x = p.x - this.w; this.vx = 0; }
        else if (this.vx < 0) { this.x = p.x + p.w; this.vx = 0; }
      }
    }
  }

  _resolveVertical(level) {
    for (const p of level.platforms) {
      if (this._overlapAABB(p.x, p.y, p.w, p.h)) {
        if (this.vy > 0) { // tombe
          this.y = p.y - this.h;
          this.vy = 0;
          this.onGround = true;
        } else if (this.vy < 0) { // saute dans le bas d'une plateforme
          this.y = p.y + p.h;
          this.vy = 0;
        }
      }
    }
    // Plateformes semi-solides (passables par le bas)
    for (const s of level.semis) {
      const prevBottom = this.y - this.vy + this.h;
      const curBottom  = this.y + this.h;
      if (
        this.vy > 0 &&
        prevBottom <= s.y + 2 &&
        curBottom >= s.y &&
        this.x + this.w > s.x &&
        this.x < s.x + s.w
      ) {
        this.y = s.y - this.h;
        this.vy = 0;
        this.onGround = true;
        this.doubleJumpUsed = false;
      }
    }
    if (this.onGround) this.doubleJumpUsed = false;
  }

  _overlapAABB(rx, ry, rw, rh) {
    return this.x < rx + rw && this.x + this.w > rx &&
           this.y < ry + rh && this.y + this.h > ry;
  }

  attackBox() {
    // Zone d'attaque devant le chat
    const st = this.stage;
    if (this.facingRight) {
      return { x: this.x + this.w, y: this.y + 4, w: st.attackRange, h: this.h - 8 };
    } else {
      return { x: this.x - st.attackRange, y: this.y + 4, w: st.attackRange, h: this.h - 8 };
    }
  }

  hitBy(source) { // source has {x,y,w,h}
    return this.invincible <= 0 &&
           this.x < source.x + source.w && this.x + this.w > source.x &&
           this.y < source.y + source.h && this.y + this.h > source.y;
  }

  _takeDamage() {
    if (this.invincible > 0) return;
    this.lives--;
    this.invincible = 150;
    this.hurtTimer = 30;
    this.vy = -8;
    if (this.lives <= 0) {
      this.dead = true;
    }
  }

  collectFish() {
    this.totalFish++;
    this.score += 100;
  }

  collectYarn()  { this.score += 50; }
  collectStar()  { this.score += 200; this.invincible = Math.max(this.invincible, 300); }
  collectHeart() { this.lives = Math.min(this.lives + 1, 5); this.score += 300; }
  collectMushroom() { this.evolutionBoost = Math.max(this.evolutionBoost, 600); this.score += 150; }
  collectBoot()     { this.bootTimer = Math.max(this.bootTimer, 480); this.score += 100; }

  addScore(n) { this.score += n; }

  _checkEvolution() {
    if (this.evolution < 2 && FISH_THRESHOLDS[this.evolution] !== undefined) {
      if (this.totalFish >= FISH_THRESHOLDS[this.evolution]) {
        this.evolution++;
        this.lives = 3; // toutes les vies restaurées à l'évolution
        this.invincible = Math.max(this.invincible, 120);
      }
    }
  }
}
