class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');
    this._resize();
    window.addEventListener('resize', () => this._resize());

    this.state = 'menu'; // menu | playing | paused | gameover | win
    this.levelIndex = 0;
    this.player = null;
    this.enemies = [];
    this.collectibles = []; // {type, x, y, w:20, h:20, alive:true}
    this.projectiles = []; // {x,y,vx,vy,w,h,traveled,alive}
    this.camera = { x: 0 };
    this.particles = []; // {x,y,vx,vy,life,color}
    this.flashTimer = 0;
    this.showEvolveMsg = 0;
    this._prevEvolution = 0;
    this._gameOverLevelIndex = 0;
    this._scoreEntryEl = null;

    // confetti for win screen
    this.confetti = [];

    // Leaderboard (localStorage)
    this._lb = this._loadLeaderboard();

    this.input = {
      left: false, right: false,
      jumpPressed: false, dashPressed: false, attackPressed: false,
    };
    this._keysDown = {};
    this._keyJustPressed = {};

    this._setupInput();
    this._setupMobileInput();
    this._loop();
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.W = this.canvas.width;
    this.H = this.canvas.height;
  }

  _setupInput() {
    window.addEventListener('keydown', (e) => {
      if (this._keysDown[e.code]) return; // already held
      this._keysDown[e.code] = true;
      this._keyJustPressed[e.code] = true;

      // State transitions
      if (e.code === 'Escape') {
        if (this.state === 'playing') this.state = 'paused';
        else if (this.state === 'paused') this.state = 'playing';
      }
      if (e.code === 'Enter') {
        if (this.state === 'menu') {
          this._restartFromLevelOne();
        } else if (this.state === 'paused') {
          this.state = 'playing';
        } else if (this.state === 'gameover') {
          this._restartFromLevelOne();
        } else if (this.state === 'win') {
          this._restartFromLevelOne();
        }
      }
      if (e.code === 'KeyN' && this.state === 'gameover') {
        this._continueCurrentLevel();
      }
    });

    window.addEventListener('keyup', (e) => {
      this._keysDown[e.code] = false;
    });
  }

  _setupMobileInput() {
    // Joystick (right side) — appears where user touches
    this._joy = { active: false, id: -1, baseX: 0, baseY: 0, dx: 0, dy: 0 };
    // Action button (left side)
    this._act = { active: false, id: -1, lastTap: 0 };
    // Just-pressed flags
    this._mobileJump    = false;
    this._mobileAttack  = false;
    this._mobileDash    = false;
    this._prevJoyUp     = false;

    const JOY_R = 60; // max thumb travel

    const onStart = (e) => {
      e.preventDefault();

      // Menus: tap to continue (pass X for gameover choice)
      if (this.state !== 'playing' && this.state !== 'paused') {
        const ft = e.changedTouches[0];
        this._menuTap(ft ? ft.clientX : this.W / 2);
        return;
      }

      for (const t of e.changedTouches) {
        const tx = t.clientX, ty = t.clientY;
        const rightZone = tx > this.W * 0.45 && ty > this.H * 0.45;
        const leftZone  = tx < this.W * 0.55 && ty > this.H * 0.45;

        if (!this._joy.active && rightZone) {
          this._joy.active = true;
          this._joy.id     = t.identifier;
          this._joy.baseX  = tx;
          this._joy.baseY  = ty;
          this._joy.dx = 0; this._joy.dy = 0;
        } else if (!this._act.active && leftZone) {
          this._act.active = true;
          this._act.id     = t.identifier;
          this._mobileAttack = true;
          const now = Date.now();
          if (now - this._act.lastTap < 320) this._mobileDash = true;
          this._act.lastTap = now;
        }
      }
    };

    const onMove = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === this._joy.id) {
          const rdx = t.clientX - this._joy.baseX;
          const rdy = t.clientY - this._joy.baseY;
          const dist = Math.hypot(rdx, rdy);
          const clamped = Math.min(dist, JOY_R);
          const angle = Math.atan2(rdy, rdx);
          this._joy.dx = Math.cos(angle) * clamped;
          this._joy.dy = Math.sin(angle) * clamped;
        }
      }
    };

    const onEnd = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === this._joy.id) {
          this._joy.active = false; this._joy.id = -1;
          this._joy.dx = 0; this._joy.dy = 0;
        }
        if (t.identifier === this._act.id) {
          this._act.active = false; this._act.id = -1;
        }
      }
    };

    this.canvas.addEventListener('touchstart', onStart, { passive: false });
    this.canvas.addEventListener('touchmove',  onMove,  { passive: false });
    this.canvas.addEventListener('touchend',   onEnd,   { passive: false });
    this.canvas.addEventListener('touchcancel',onEnd,   { passive: false });
  }

  _menuTap(touchX = this.W / 2) {
    if (this.state === 'menu') {
      this._restartFromLevelOne();
    } else if (this.state === 'paused') {
      this.state = 'playing';
    } else if (this.state === 'gameover') {
      // Right half = continue current level, left half = restart from 1
      if (touchX >= this.W / 2) this._continueCurrentLevel();
      else this._restartFromLevelOne();
    } else if (this.state === 'win') {
      this._restartFromLevelOne();
    }
  }

  _restartFromLevelOne() {
    this.levelIndex = 0;
    this.startLevel(0);
    this.player.lives     = 3;
    this.player.score     = 0;
    this.player.totalFish = 0;
    this.player.evolution = 0;
    this.state = 'playing';
  }

  _continueCurrentLevel() {
    const idx = this._gameOverLevelIndex || 0;
    this.levelIndex = idx;
    this.startLevel(idx); // carries over score/fish/evolution from dead player
    this.player.lives = 1;
    this.state = 'playing';
  }

  startLevel(idx) {
    const lvl = LEVELS[idx];
    this.currentLevel = lvl;

    const prevPlayer = this.player;
    this.player = new Player(lvl.startX, lvl.startY);

    // Carry over progression from previous levels
    if (prevPlayer) {
      this.player.lives      = prevPlayer.lives;
      this.player.score      = prevPlayer.score;
      this.player.totalFish  = prevPlayer.totalFish;
      this.player.evolution  = prevPlayer.evolution;
    }

    this._prevEvolution = this.player.evolution;

    this.enemies = lvl.enemies.map(e => new Enemy(e.type, e.x, e.y));
    this.collectibles = lvl.collectibles.map(c => ({
      type: c.type, x: c.x, y: c.y, w: 20, h: 20, alive: true,
    }));

    this.camera = { x: 0 };
    this.particles = [];
    this.projectiles = [];
    this.flashTimer = 0;
    this.showEvolveMsg = 0;

    // Snap player directly onto ground at spawn position
    const spawnMidX = lvl.startX + this.player.w / 2;
    const groundPlatform = lvl.platforms.find(
      p => spawnMidX >= p.x && spawnMidX <= p.x + p.w
    );
    if (groundPlatform) {
      this.player.y  = groundPlatform.y - this.player.h;
      this.player.vy = 1; // triggers _resolveVertical landing on first frame
    }

    // Reset joystick so movement from previous level doesn't carry over
    if (this._joy) {
      this._joy.active = false;
      this._joy.id     = -1;
      this._joy.dx     = 0;
      this._joy.dy     = 0;
    }
    this._prevJoyUp   = false;
    this._mobileAttack = false;
    this._mobileDash   = false;

    this.checkpoints = (lvl.checkpoints || []).map(cp => ({
      x: cp.x, y: cp.y, activated: false,
    }));
    this.activeCheckpointX = lvl.startX;
    this.activeCheckpointY = lvl.startY;
    this.showCheckpointMsg = 0;
  }

  _loop() {
    this._update();
    this._render();
    requestAnimationFrame(() => this._loop());
  }

  _update() {
    // Reset all inputs each frame so nothing stays sticky
    this.input.left          = false;
    this.input.right         = false;
    this.input.jumpPressed   = false;
    this.input.dashPressed   = false;
    this.input.attackPressed = false;

    const k  = this._keysDown;
    const jp = this._keyJustPressed;

    // ── Joystick (right zone) ──
    const DEAD = 18;
    if (this._joy.active) {
      if (this._joy.dx >  DEAD) this.input.right = true;
      if (this._joy.dx < -DEAD) this.input.left  = true;
      // Jump on rising edge of upward flick
      const joyUp = this._joy.dy < -DEAD;
      if (joyUp && !this._prevJoyUp) this.input.jumpPressed = true;
      this._prevJoyUp = joyUp;
    } else {
      this._prevJoyUp = false;
    }

    // ── Keyboard (ORed on top) ──
    if (k['ArrowLeft']  || k['KeyA'])  this.input.left  = true;
    if (k['ArrowRight'] || k['KeyD'])  this.input.right = true;
    if (jp['ArrowUp']   || jp['KeyW'] || jp['Space']) this.input.jumpPressed  = true;
    if (jp['ShiftLeft'] || jp['ShiftRight'] || jp['KeyX']) this.input.dashPressed = true;
    if (jp['KeyZ']      || jp['ArrowDown'])            this.input.attackPressed = true;

    // ── Mobile one-shot flags ──
    if (this._mobileDash)   { this.input.dashPressed   = true; this._mobileDash   = false; }
    if (this._mobileAttack) { this.input.attackPressed = true; this._mobileAttack = false; }

    // Reset just-pressed
    this._keyJustPressed = {};

    if (this.state !== 'playing') {
      // Update confetti for win screen
      if (this.state === 'win') {
        this._updateConfetti();
      }
      return;
    }

    const lvl = this.currentLevel;
    const player = this.player;

    // Update player
    const prevEvolution = player.evolution;
    const prevAttackTimer = player.attackTimer;
    const prevVy = player.vy;
    player.update(this.input, lvl);

    // Stage 2: spawn kitten projectile on new attack
    if (prevAttackTimer <= 0 && player.attackTimer > 0 && player.evolution === 2) {
      const dir = player.facingRight ? 1 : -1;
      this.projectiles.push({
        x: player.x + (dir > 0 ? player.w : -4),
        y: player.y + player.h * 0.15,
        vx: dir * 9, vy: -2.5,
        w: 20, h: 18, traveled: 0, alive: true,
      });
    }

    // Update projectiles
    for (const pr of this.projectiles) {
      if (!pr.alive) continue;
      pr.x += pr.vx; pr.vy += 0.18; pr.y += pr.vy;
      pr.traveled += Math.abs(pr.vx);
      if (pr.traveled > 680 || pr.x < -80 || pr.x > lvl.width + 80) { pr.alive = false; continue; }
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (pr.x < e.x + e.w && pr.x + pr.w > e.x && pr.y < e.y + e.h && pr.y + pr.h > e.y) {
          if (e.hurtTimer <= 0) {
            e.takeHit(2);
            player.addScore(e.alive ? 30 : e.def.score);
            if (!e.alive) this._spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#ff6600', 10);
          }
          pr.alive = false;
          this._spawnParticles(pr.x + 10, pr.y + 9, '#f0a844', 6);
          break;
        }
      }
    }
    this.projectiles = this.projectiles.filter(p => p.alive);

    // Fall into void → respawn at last checkpoint (or level start)
    if (player.y > lvl.height + 80 && !player.dead && player.invincible <= 0) {
      player._takeDamage();
      if (!player.dead) {
        player.x  = this.activeCheckpointX;
        player.y  = this.activeCheckpointY - 20;
        player.vx = 0; player.vy = 1;
        player.invincible = Math.max(player.invincible, 200);
        this._spawnParticles(player.cx, player.cy, '#ffaa00', 12);
      }
    }

    // Detect evolution change
    if (player.evolution > prevEvolution) {
      this.showEvolveMsg = 180;
      this._spawnEvolutionParticles();
    }

    // STOMP: player was falling fast → kills enemy on landing from above
    if (!player.dead && prevVy > 2) {
      const pb  = player.y + player.h;
      const ppb = pb - prevVy; // where bottom was before this frame
      for (const e of this.enemies) {
        if (!e.alive || e.hurtTimer > 0) continue;
        if (e.def && e.def.isBoss) continue;
        if (
          pb >= e.y && ppb <= e.y + 6 &&
          player.x + player.w * 0.2 < e.x + e.w &&
          player.x + player.w * 0.8 > e.x
        ) {
          const scoreGain = e.def.score;
          e.takeHit(99);
          player.vy = -10;
          player.onGround = false;
          player.addScore(scoreGain);
          this._spawnParticles(e.x + e.w / 2, e.y, '#ffee44', 14);
        }
      }
    }

    // Update enemies
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.update(lvl, player);

      // Bird bounds: bounce off level edges
      if (e.def && e.def.flies) {
        if (e.x < 0) { e.x = 0; e.vx = Math.abs(e.vx); }
        if (e.x + e.w > lvl.width) { e.x = lvl.width - e.w; e.vx = -Math.abs(e.vx); }
      }
    }

    // Spikes: check player collision
    for (const sp of lvl.spikes) {
      if (player.bootTimer > 0) continue; // spike immunity from boot power-up
      if (player.x < sp.x + sp.w && player.x + player.w > sp.x &&
          player.y + player.h > sp.y && player.y < sp.y + 16) {
        player._takeDamage();
      }
    }

    // Player ↔ enemy body collision
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (player.hitBy(e)) {
        player._takeDamage();
        this.flashTimer = 8;
        this._spawnParticles(player.cx, player.cy, '#ff4444', 6);
      }
    }

    // Attack ↔ enemies
    if (player.attackTimer > 0) {
      const ab = player.attackBox();
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (e.x < ab.x + ab.w && e.x + e.w > ab.x &&
            e.y < ab.y + ab.h && e.y + e.h > ab.y) {
          if (e.hurtTimer <= 0) {
            e.takeHit(player.stage.attackDmg);
            player.addScore(e.alive ? 20 : e.def.score);
            this._spawnParticles(e.x + e.w/2, e.y + e.h/2, '#ffaa00', e.alive ? 4 : 10);
            if (!e.alive) {
              this._spawnParticles(e.x + e.w/2, e.y + e.h/2, '#ff6600', 8);
            }
          }
        }
      }
    }

    // Collectibles
    for (const c of this.collectibles) {
      if (!c.alive) continue;
      if (player.x < c.x + c.w && player.x + player.w > c.x &&
          player.y < c.y + c.h && player.y + player.h > c.y) {
        c.alive = false;
        if (c.type === 'fish') {
          player.collectFish();
          this._spawnParticles(c.x + 10, c.y + 10, '#4488ff', 5);
        } else if (c.type === 'yarn') {
          player.collectYarn();
          this._spawnParticles(c.x + 10, c.y + 10, '#ff88cc', 5);
        } else if (c.type === 'star') {
          player.collectStar();
          this._spawnParticles(c.x + 10, c.y + 10, '#ffee00', 8);
        } else if (c.type === 'heart') {
          player.collectHeart();
          this._spawnParticles(c.x + 10, c.y + 10, '#ff4488', 10);
        } else if (c.type === 'mushroom') {
          player.collectMushroom();
          this._spawnParticles(c.x + 10, c.y + 10, '#ff8800', 10);
          this.showEvolveMsg = 90;
        } else if (c.type === 'boot_powerup') {
          player.collectBoot();
          this._spawnParticles(c.x + 10, c.y + 10, '#d4a020', 8);
        }
      }
    }

    // Checkpoints
    for (const cp of this.checkpoints) {
      if (!cp.activated &&
          Math.abs((player.x + player.w / 2) - cp.x) < 36 &&
          player.y + player.h >= cp.y - 8) {
        cp.activated = true;
        this.activeCheckpointX = cp.x - player.w / 2;
        this.activeCheckpointY = cp.y - player.h;
        this._spawnParticles(cp.x, cp.y - 20, '#00ee88', 18);
        this.showCheckpointMsg = 150;
      }
    }

    // Exit check
    const ex = lvl.exitX, ey = lvl.exitY;
    if (player.x < ex + 48 && player.x + player.w > ex &&
        player.y < ey + 48 && player.y + player.h > ey) {
      if (this.levelIndex < LEVELS.length - 1) {
        this.levelIndex++;
        this.startLevel(this.levelIndex);
      } else {
        player.won = true;
        this.state = 'win';
        this._initConfetti();
        setTimeout(() => { if (this.state === 'win') this._showScoreEntry(player.score, player.evolution, this.levelIndex); }, 2200);
      }
    }

    // Death check
    if (player.dead) {
      this._gameOverLevelIndex = this.levelIndex;
      this.state = 'gameover';
      setTimeout(() => { if (this.state === 'gameover') this._showScoreEntry(player.score, player.evolution, this._gameOverLevelIndex); }, 1600);
    }

    // Camera: follow player horizontally
    const targetCamX = player.cx - this.W / 2;
    const maxCamX = lvl.width - this.W;
    this.camera.x = Math.max(0, Math.min(targetCamX, maxCamX));

    // Flash
    if (this.flashTimer > 0) this.flashTimer--;

    // Evolve msg
    if (this.showEvolveMsg > 0) this.showEvolveMsg--;
    if (this.showCheckpointMsg > 0) this.showCheckpointMsg--;

    // Update particles
    this._updateParticles();
  }

  _spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 30 + Math.floor(Math.random() * 20),
        maxLife: 50,
        color,
      });
    }
  }

  _spawnEvolutionParticles() {
    const p = this.player;
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      const colors = ['#ffee44', '#ff8800', '#ffffff', '#ffaa00'];
      this.particles.push({
        x: p.cx, y: p.cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 50 + Math.floor(Math.random() * 30),
        maxLife: 80,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  _updateParticles() {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.3;
      p.life--;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  _initConfetti() {
    this.confetti = [];
    for (let i = 0; i < 120; i++) {
      this.confetti.push({
        x: Math.random() * this.W,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 3,
        vy: 1.5 + Math.random() * 2,
        color: ['#ff4444','#ffaa00','#44ff44','#4488ff','#ff88ff','#ffee00'][Math.floor(Math.random()*6)],
        w: 8 + Math.random() * 8,
        h: 4 + Math.random() * 4,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.2,
      });
    }
  }

  _updateConfetti() {
    for (const c of this.confetti) {
      c.x += c.vx;
      c.y += c.vy;
      c.rot += c.rotV;
      if (c.y > this.H + 20) {
        c.y = -20;
        c.x = Math.random() * this.W;
      }
    }
  }

  // ───────────────────────────────────────── RENDER ──────────
  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    if (this.state === 'menu') {
      this._drawMenu();
      return;
    }

    // Draw the game world (playing, paused, gameover, win all show world)
    if (this.player && this.currentLevel) {
      this._renderWorld();
    }

    if (this.state === 'paused') {
      this._drawPause();
    } else if (this.state === 'gameover') {
      this._drawGameOver();
    } else if (this.state === 'win') {
      this._drawWin();
    }
  }

  _renderWorld() {
    const ctx = this.ctx;
    const lvl = this.currentLevel;
    const cam = this.camera;

    // Background gradient (full screen, no camera offset)
    const grad = ctx.createLinearGradient(0, 0, 0, this.H);
    grad.addColorStop(0, lvl.bgTop);
    grad.addColorStop(1, lvl.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.W, this.H);

    // Flash overlay
    if (this.flashTimer > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flashTimer / 15})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }

    // World offset
    ctx.save();
    ctx.translate(-cam.x, 0);

    // Background decorations
    this._drawBgDecos(lvl);

    // Spikes
    ctx.fillStyle = COLORS.spike;
    for (const sp of lvl.spikes) {
      const count = Math.floor(sp.w / 12);
      const tw = sp.w / count;
      for (let i = 0; i < count; i++) {
        ctx.beginPath();
        ctx.moveTo(sp.x + i * tw, sp.y + 16);
        ctx.lineTo(sp.x + i * tw + tw / 2, sp.y);
        ctx.lineTo(sp.x + (i + 1) * tw, sp.y + 16);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Solid platforms
    for (const p of lvl.platforms) {
      // Main body
      ctx.fillStyle = lvl.groundColor || COLORS.platform;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      // Top lighter strip
      ctx.fillStyle = COLORS.platformTop;
      ctx.fillRect(p.x, p.y, p.w, 6);
    }

    // Semi-solid platforms
    for (const s of lvl.semis) {
      const h = 12;
      ctx.fillStyle = '#8B6040';
      ctx.fillRect(s.x, s.y, s.w, h);
      ctx.fillStyle = '#b08060';
      ctx.fillRect(s.x, s.y, s.w, 4);
    }

    // Collectibles
    for (const c of this.collectibles) {
      if (!c.alive) continue;
      this._drawCollectible(c);
    }

    // Checkpoints
    for (const cp of this.checkpoints) {
      this._drawCheckpoint(cp);
    }

    // Enemies
    for (const e of this.enemies) {
      if (!e.alive) continue;
      this._drawEnemy(e);
    }

    // Player
    this._drawCat(this.player);

    // Projectiles (kittens)
    for (const pr of this.projectiles) this._drawProjectile(pr);

    // Exit
    this._drawExit(lvl);

    // Particles
    for (const p of this.particles) {
      const alpha = p.life / (p.maxLife || 50);
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // HUD (screen space)
    this._drawHUD();
    // Mobile controls overlay
    this._drawMobileControls();
  }

  _drawMobileControls() {
    if (this.W > 768) return; // desktop only skip
    const ctx = this.ctx;
    const JOY_R = 60;

    // ── Joystick (right side) ──
    const joy = this._joy;
    const jbx = joy.active ? joy.baseX : this.W - 100;
    const jby = joy.active ? joy.baseY : this.H - 100;
    const thumbX = jbx + joy.dx;
    const thumbY = jby + joy.dy;

    // Base ring
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(jbx, jby, JOY_R, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(jbx, jby, JOY_R, 0, Math.PI * 2); ctx.stroke();

    // Direction hints
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('▲', jbx, jby - JOY_R + 14);
    ctx.fillText('◀', jbx - JOY_R + 14, jby);
    ctx.fillText('▶', jbx + JOY_R - 14, jby);

    // Thumb
    ctx.globalAlpha = joy.active ? 0.65 : 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(thumbX, thumbY, 26, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // ── Action button (left side) ──
    const ax = 90, ay = this.H - 100, ar = 50;
    ctx.save();
    ctx.globalAlpha = this._act.active ? 0.55 : 0.28;
    ctx.fillStyle = '#ff7733';
    ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Action', ax, ay);
    ctx.restore();
  }

  _drawBgDecos(lvl) {
    const ctx = this.ctx;
    const num = lvl.num;

    if (num === 1) {
      // Trees
      const treePositions = [100, 350, 650, 950, 1280, 1600, 1900, 2200, 2450];
      ctx.fillStyle = '#2d5a1b';
      for (const tx of treePositions) {
        // Trunk
        ctx.fillStyle = '#6B4226';
        ctx.fillRect(tx + 10, lvl.height - 120, 12, 56);
        // Foliage
        ctx.fillStyle = '#2d8b1b';
        ctx.beginPath();
        ctx.arc(tx + 16, lvl.height - 140, 32, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3aaa22';
        ctx.beginPath();
        ctx.arc(tx + 26, lvl.height - 160, 22, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (num === 2) {
      // Buildings / rooftops
      const buildings = [100, 420, 780, 1100, 1450, 1780, 2100, 2500];
      for (const bx of buildings) {
        const bh = 200 + Math.floor((bx * 17) % 100);
        ctx.fillStyle = '#3a2a2a';
        ctx.fillRect(bx, lvl.height - bh, 80, bh);
        // Windows
        ctx.fillStyle = '#ffee88';
        for (let wy = lvl.height - bh + 20; wy < lvl.height - 30; wy += 40) {
          for (let wx = bx + 10; wx < bx + 70; wx += 30) {
            if (Math.sin(bx + wx + wy) > 0) {
              ctx.fillRect(wx, wy, 14, 18);
            }
          }
        }
      }
    } else if (num === 3) {
      // Underground: stalactites + glowing mushrooms
      for (let mx = 80; mx < lvl.width; mx += 220) {
        // Stalactite
        ctx.fillStyle = '#4a3a5a';
        ctx.beginPath();
        ctx.moveTo(mx, 0);
        ctx.lineTo(mx + 20, 80 + (mx % 60));
        ctx.lineTo(mx - 20, 0);
        ctx.closePath();
        ctx.fill();
        // Mushroom
        ctx.fillStyle = '#cc2244';
        ctx.beginPath();
        ctx.arc(mx + 30, lvl.height - 80, 20, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#885522';
        ctx.fillRect(mx + 26, lvl.height - 80, 8, 24);
        // Spots
        ctx.fillStyle = '#ffaaaa';
        ctx.beginPath();
        ctx.arc(mx + 22, lvl.height - 90, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(mx + 40, lvl.height - 92, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (num === 4) {
      // City: skyscrapers, neon signs
      for (let bx = 0; bx < lvl.width; bx += 160) {
        const bh = 180 + (bx * 13) % 200;
        const col = (bx * 7) % 3;
        ctx.fillStyle = ['#151520','#101020','#1a1530'][col];
        ctx.fillRect(bx, lvl.height - bh, 140, bh);
        // Windows
        for (let wy = lvl.height - bh + 15; wy < lvl.height - 30; wy += 25) {
          for (let wx = bx + 10; wx < bx + 130; wx += 22) {
            const lit = Math.sin(bx * 0.3 + wx * 0.7 + wy * 0.5) > 0.2;
            ctx.fillStyle = lit ? '#ffffaa' : '#223';
            ctx.fillRect(wx, wy, 10, 14);
          }
        }
      }
      // Neon signs
      const neons = [[200,'#ff2288'],[600,'#22ffcc'],[1100,'#ff8800'],[1600,'#44aaff'],[2200,'#ffee00']];
      for (const [nx, nc] of neons) {
        ctx.strokeStyle = nc;
        ctx.lineWidth = 3;
        ctx.shadowColor = nc;
        ctx.shadowBlur = 12;
        ctx.strokeRect(nx, lvl.height - 160, 60, 30);
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1;
      }
    } else if (num === 5) {
      // Fortress: torches + stone
      ctx.fillStyle = '#1a0808';
      ctx.fillRect(0, 0, lvl.width, lvl.height);

      for (let tx = 300; tx < lvl.width; tx += 380) {
        // Stone column
        ctx.fillStyle = '#2a1a1a';
        ctx.fillRect(tx, lvl.height - 300, 40, 240);
        // Torch
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(tx + 15, lvl.height - 310, 10, 20);
        // Flame
        const flicker = Math.sin(Date.now() * 0.008 + tx) * 3;
        const flameGrad = ctx.createRadialGradient(tx + 20, lvl.height - 318 + flicker, 2, tx + 20, lvl.height - 318, 16);
        flameGrad.addColorStop(0, '#ffffff');
        flameGrad.addColorStop(0.3, '#ffcc00');
        flameGrad.addColorStop(1, 'rgba(255,44,0,0)');
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.arc(tx + 20, lvl.height - 318 + flicker, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  _drawCollectible(c) {
    const ctx = this.ctx;
    const pulse = Math.sin(Date.now() * 0.005 + c.x * 0.05) * 2;

    if (c.type === 'fish') {
      // Fish: body + tail in blue
      ctx.save();
      ctx.translate(c.x + 10, c.y + 10 + pulse);
      ctx.fillStyle = '#2266cc';
      // Body
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      // Tail
      ctx.fillStyle = '#1144aa';
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(-16, -5);
      ctx.lineTo(-16, 5);
      ctx.closePath();
      ctx.fill();
      // Eye
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(5, -1, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(5.5, -1, 1, 0, Math.PI * 2);
      ctx.fill();
      // Shimmer
      ctx.strokeStyle = 'rgba(150,200,255,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(2, -3);
      ctx.lineTo(0, 3);
      ctx.stroke();
      ctx.restore();
    } else if (c.type === 'yarn') {
      // Yarn ball: pink circle with lines
      ctx.save();
      ctx.translate(c.x + 10, c.y + 10 + pulse);
      ctx.fillStyle = '#ff88cc';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#cc44aa';
      ctx.lineWidth = 1.5;
      // Cross lines
      for (let a = 0; a < Math.PI; a += Math.PI / 3) {
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * -10, Math.sin(a) * -10);
        ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,200,230,0.6)';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (c.type === 'heart') {
      ctx.save();
      ctx.translate(c.x + 10, c.y + 10 + pulse);
      ctx.fillStyle = '#ff2255';
      ctx.shadowColor = '#ff88aa'; ctx.shadowBlur = 14;
      const s = 10;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.35);
      ctx.bezierCurveTo(0, 0, -s, 0, -s, s * 0.35);
      ctx.bezierCurveTo(-s, s * 0.75, 0, s * 1.3, 0, s * 1.6);
      ctx.bezierCurveTo(0, s * 1.3, s, s * 0.75, s, s * 0.35);
      ctx.bezierCurveTo(s, 0, 0, 0, 0, s * 0.35);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.ellipse(-4, 2, 3, 2, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (c.type === 'star') {
      // Star: 5-point yellow
      ctx.save();
      ctx.translate(c.x + 10, c.y + 10 + pulse);
      ctx.fillStyle = '#ffee00';
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      const spikes = 5, outer = 10, inner = 4;
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const angle = (i * Math.PI / spikes) - Math.PI / 2;
        if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    } else if (c.type === 'mushroom') {
      ctx.save();
      ctx.translate(c.x + 10, c.y + 10 + pulse);
      // Stem
      ctx.fillStyle = '#f0d8a0';
      ctx.fillRect(-6, 2, 12, 10);
      // Cap
      ctx.fillStyle = '#cc3300';
      ctx.shadowColor = '#ff5500'; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, -1, 12, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      // White dots
      ctx.fillStyle = '#ffffff';
      for (const [dx, dy] of [[-4, -5], [4, -6], [0, -2]]) {
        ctx.beginPath(); ctx.arc(dx, dy, 2.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    } else if (c.type === 'boot_powerup') {
      ctx.save();
      ctx.translate(c.x + 10, c.y + 12 + pulse);
      ctx.fillStyle = '#d4a020';
      ctx.shadowColor = '#ffcc44'; ctx.shadowBlur = 10;
      // Sole
      ctx.fillStyle = '#8a6010';
      ctx.fillRect(-10, 3, 20, 5);
      // Boot upper
      ctx.fillStyle = '#d4a020';
      ctx.fillRect(-7, -8, 10, 11);
      // Toe cap
      ctx.beginPath();
      ctx.ellipse(4, 4, 7, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Buckle
      ctx.strokeStyle = '#ffee88'; ctx.lineWidth = 1.5;
      ctx.strokeRect(-5, -5, 6, 4);
      ctx.restore();
    }
  }

  _drawCheckpoint(cp) {
    const ctx = this.ctx;
    const act = cp.activated;
    // Pole
    ctx.strokeStyle = act ? '#aaaaaa' : '#665544';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cp.x, cp.y);
    ctx.lineTo(cp.x, cp.y - 52);
    ctx.stroke();
    // Flag
    ctx.fillStyle = act ? '#00dd66' : '#886655';
    if (act) { ctx.shadowColor = '#00ff88'; ctx.shadowBlur = 16; }
    ctx.beginPath();
    ctx.moveTo(cp.x + 1, cp.y - 52);
    ctx.lineTo(cp.x + 22, cp.y - 43);
    ctx.lineTo(cp.x + 1, cp.y - 34);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    // Star on flag when activated
    if (act) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('★', cp.x + 5, cp.y - 40);
    }
  }

  _drawExit(lvl) {
    const ctx = this.ctx;
    const ex = lvl.exitX, ey = lvl.exitY;
    const pulse = Math.sin(Date.now() * 0.004) * 4;

    ctx.shadowColor = COLORS.exit;
    ctx.shadowBlur = 20 + pulse;
    ctx.strokeStyle = COLORS.exit;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ex + 24, ey + 24, 24 + pulse * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner star/portal
    ctx.fillStyle = `rgba(64,224,112,${0.3 + Math.sin(Date.now() * 0.005) * 0.1})`;
    ctx.beginPath();
    ctx.arc(ex + 24, ey + 24, 20, 0, Math.PI * 2);
    ctx.fill();

    // Door icon
    ctx.fillStyle = COLORS.exit;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('>', ex + 24, ey + 24);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 1;
  }

  _drawEnemy(e) {
    const ctx = this.ctx;
    const t = e.type;
    const hurt = e.hurtTimer > 0;

    ctx.save();
    if (hurt) {
      ctx.globalAlpha = 0.6;
      ctx.filter = 'brightness(2)';
    }

    if (t === 'mouse') {
      this._drawMouse(e);
    } else if (t === 'bird') {
      this._drawBird(e);
    } else if (t === 'rat') {
      this._drawRat(e);
    } else if (t === 'dog') {
      this._drawDog(e);
    } else if (t === 'boss') {
      this._drawBoss(e);
    }

    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.restore();

    // HP bar for boss
    if (t === 'boss' && e.alive) {
      const bw = 60;
      const bx = e.x + e.w / 2 - bw / 2;
      const by = e.y - 14;
      ctx.fillStyle = '#333';
      ctx.fillRect(bx, by, bw, 8);
      ctx.fillStyle = e.phase2 ? '#ff2244' : '#44cc44';
      ctx.fillRect(bx, by, bw * (e.hp / 12), 8);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, bw, 8);
    }
  }

  _drawMouse(e) {
    const ctx = this.ctx;
    const x = e.x, y = e.y;
    const facing = e.vx >= 0 ? 1 : -1;

    ctx.save();
    ctx.translate(x + e.w / 2, y + e.h / 2);
    if (facing < 0) ctx.scale(-1, 1);

    // Body
    ctx.fillStyle = '#999';
    ctx.beginPath();
    ctx.ellipse(0, 2, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#aaa';
    ctx.beginPath();
    ctx.arc(9, -1, 7, 0, Math.PI * 2);
    ctx.fill();

    // Ears (round)
    ctx.fillStyle = '#bbb';
    ctx.beginPath();
    ctx.arc(6, -7, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(12, -7, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffaaaa';
    ctx.beginPath();
    ctx.arc(6, -7, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(12, -7, 2, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(12, -2, 2, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = '#ff8899';
    ctx.beginPath();
    ctx.arc(16, 1, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Tail (long, curvy)
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, 4);
    ctx.bezierCurveTo(-18, -2, -22, 6, -18, 10);
    ctx.stroke();

    ctx.restore();
  }

  _drawBird(e) {
    const ctx = this.ctx;
    const x = e.x, y = e.y;
    const facing = e.vx >= 0 ? 1 : -1;
    const wingFlap = Math.sin(e.animTick * 0.25) * 0.5;

    ctx.save();
    ctx.translate(x + e.w / 2, y + e.h / 2);
    if (facing < 0) ctx.scale(-1, 1);

    // Body
    ctx.fillStyle = '#5588aa';
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wings
    ctx.fillStyle = '#4477aa';
    ctx.save();
    ctx.rotate(-wingFlap);
    ctx.beginPath();
    ctx.moveTo(-2, -2);
    ctx.lineTo(-14, -8 - wingFlap * 6);
    ctx.lineTo(-8, 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.rotate(wingFlap);
    ctx.beginPath();
    ctx.moveTo(2, -2);
    ctx.lineTo(14, -8 - wingFlap * 6);
    ctx.lineTo(8, 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Head
    ctx.fillStyle = '#6699bb';
    ctx.beginPath();
    ctx.arc(9, -3, 6, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.moveTo(14, -3);
    ctx.lineTo(20, -1);
    ctx.lineTo(14, 1);
    ctx.closePath();
    ctx.fill();

    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(11, -4, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(11.5, -4, 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawRat(e) {
    const ctx = this.ctx;
    const x = e.x, y = e.y;
    const facing = e.vx >= 0 ? 1 : -1;

    ctx.save();
    ctx.translate(x + e.w / 2, y + e.h / 2);
    if (facing < 0) ctx.scale(-1, 1);

    // Body (larger, darker)
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.ellipse(0, 2, 12, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#666';
    ctx.beginPath();
    ctx.arc(11, -1, 8, 0, Math.PI * 2);
    ctx.fill();

    // Pointy ears
    ctx.fillStyle = '#777';
    ctx.beginPath();
    ctx.moveTo(7, -7);
    ctx.lineTo(5, -14);
    ctx.lineTo(11, -9);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(13, -8);
    ctx.lineTo(15, -15);
    ctx.lineTo(18, -7);
    ctx.closePath();
    ctx.fill();

    // Red eyes
    ctx.fillStyle = '#ff2222';
    ctx.beginPath();
    ctx.arc(13, -2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#550000';
    ctx.beginPath();
    ctx.arc(13.5, -2, 1, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = '#ff6688';
    ctx.beginPath();
    ctx.arc(18, 1, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Thin tail
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-12, 4);
    ctx.bezierCurveTo(-22, -4, -28, 8, -24, 14);
    ctx.stroke();

    ctx.restore();
  }

  _drawDog(e) {
    const ctx = this.ctx;
    const x = e.x, y = e.y;
    const facing = e.vx >= 0 ? 1 : -1;
    const isCharging = e.chargeCooldown > 100;

    ctx.save();
    ctx.translate(x + e.w / 2, y + e.h / 2);
    if (facing < 0) ctx.scale(-1, 1);

    // Body
    ctx.fillStyle = '#8B6040';
    ctx.beginPath();
    ctx.roundRect(-12, -8, 24, 18, 4);
    ctx.fill();

    // Head
    ctx.fillStyle = '#9B7050';
    ctx.beginPath();
    ctx.roundRect(5, -16, 20, 18, 5);
    ctx.fill();

    // Floppy ears
    ctx.fillStyle = '#7a5030';
    ctx.beginPath();
    ctx.ellipse(7, -10, 5, 8, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(22, -10, 5, 8, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(12, -10, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(20, -10, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Eyeshine
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(12.7, -10.7, 1, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.ellipse(23, -4, 3.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mouth / babines if charging
    if (isCharging) {
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(18, -1);
      ctx.lineTo(15, 2);
      ctx.lineTo(21, 2);
      ctx.stroke();
      // teeth
      ctx.fillStyle = '#fff';
      ctx.fillRect(16, 1, 3, 3);
      ctx.fillRect(20, 1, 3, 3);
    }

    // Tail
    ctx.strokeStyle = '#7a5030';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-12, -4);
    ctx.bezierCurveTo(-20, -12, -24, -4, -20, 2);
    ctx.stroke();

    // Legs
    ctx.fillStyle = '#8B6040';
    ctx.fillRect(-10, 8, 6, 8);
    ctx.fillRect(-2, 8, 6, 8);
    ctx.fillRect(6, 8, 6, 8);
    ctx.fillRect(14, 8, 6, 8);

    ctx.restore();
  }

  _drawBoss(e) {
    const ctx = this.ctx;
    const x = e.x, y = e.y;
    const facing = e.vx >= 0 ? 1 : -1;
    const phase2 = e.phase2;
    const pulse = Math.sin(e.animTick * 0.1) * 3;

    ctx.save();
    ctx.translate(x + e.w / 2, y + e.h / 2);
    if (facing < 0) ctx.scale(-1, 1);

    // Body (large)
    ctx.fillStyle = phase2 ? '#8B1010' : '#6B3010';
    ctx.beginPath();
    ctx.roundRect(-20, -14, 40, 30, 6);
    ctx.fill();

    // Head
    ctx.fillStyle = phase2 ? '#9B2020' : '#7B4020';
    ctx.beginPath();
    ctx.roundRect(4, -26, 32, 28, 8);
    ctx.fill();

    // Spiky crown
    ctx.fillStyle = '#cc8800';
    for (let i = 0; i < 5; i++) {
      const spx = 6 + i * 7;
      ctx.beginPath();
      ctx.moveTo(spx, -26);
      ctx.lineTo(spx + 3, -34 - (i % 2 === 0 ? 6 : 0));
      ctx.lineTo(spx + 6, -26);
      ctx.closePath();
      ctx.fill();
    }

    // Ears (big, pointy)
    ctx.fillStyle = '#5B2010';
    ctx.beginPath();
    ctx.moveTo(6, -24);
    ctx.lineTo(2, -38);
    ctx.lineTo(14, -22);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(32, -24);
    ctx.lineTo(38, -38);
    ctx.lineTo(28, -22);
    ctx.closePath();
    ctx.fill();

    // Glowing red eyes
    const eyeGlow = phase2 ? 15 + pulse : 8;
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = eyeGlow;
    ctx.fillStyle = '#ff2222';
    ctx.beginPath();
    ctx.arc(14, -15, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(26, -15, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Pupils
    ctx.fillStyle = '#550000';
    ctx.beginPath();
    ctx.arc(15, -15, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(27, -15, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.ellipse(33, -7, 5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fangs
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(22, -4);
    ctx.lineTo(19, 4);
    ctx.lineTo(25, 4);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(30, -4);
    ctx.lineTo(27, 4);
    ctx.lineTo(33, 4);
    ctx.closePath();
    ctx.fill();

    // Collar with spikes
    ctx.fillStyle = '#333';
    ctx.fillRect(4, -2, 32, 6);
    ctx.fillStyle = '#888';
    for (let i = 6; i < 36; i += 7) {
      ctx.beginPath();
      ctx.moveTo(i, -2);
      ctx.lineTo(i + 3, -8);
      ctx.lineTo(i + 6, -2);
      ctx.fill();
    }

    // Legs
    ctx.fillStyle = phase2 ? '#8B1010' : '#6B3010';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(-18 + i * 12, 14, 10, 12);
    }

    ctx.restore();

    // Phase 2 aura
    if (phase2) {
      ctx.save();
      ctx.globalAlpha = 0.15 + Math.sin(e.animTick * 0.12) * 0.08;
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.ellipse(x + e.w / 2, y + e.h / 2, e.w * 1.2, e.h * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  _drawCat(player) {
    if (!player || player.dead) return;
    const ctx = this.ctx;
    const st = player.stage;

    if (player.invincible > 0 && Math.floor(player.animTick / 6) % 2 === 1) return;

    const x = player.x, y = player.y, w = player.w, h = player.h;
    const isMoving = Math.abs(player.vx) > 0.5;
    const tick = player.animTick;
    const hurt = player.hurtTimer > 0;
    const attacking = player.attackTimer > 0;
    const bodyColor = hurt ? '#ffffff' : st.color;

    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    if (!player.facingRight) ctx.scale(-1, 1);

    // ── Dash trail ──
    if (player.dashTimer > 0) {
      for (let i = 1; i <= 4; i++) {
        ctx.globalAlpha = 0.07 * (5 - i);
        ctx.fillStyle = st.color;
        ctx.beginPath();
        ctx.ellipse(-i * 9, 0, w * 0.38, h * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // ── Cape + Boots : uniquement stade 1+ (Chat Potté) ──
    const capeSwing = isMoving ? Math.sin(tick * 0.15) * 6 : 0;
    const legSwing  = isMoving ? Math.sin(tick * 0.3)  * 3 : 0;
    if (player.evolution >= 1) {
      // Cape
      ctx.fillStyle = player.evolution === 2 ? '#5a0000' : '#8B1010';
      ctx.beginPath();
      ctx.moveTo(-w * 0.25, -h * 0.15);
      ctx.quadraticCurveTo(-w * 0.65, h * 0.1 + capeSwing, -w * 0.45, h * 0.42 + capeSwing * 0.5);
      ctx.lineTo(-w * 0.05, h * 0.38);
      ctx.lineTo(-w * 0.05, -h * 0.18);
      ctx.closePath();
      ctx.fill();
      // Boots
      const bootColor = '#3a2010', cuffColor = '#5a3820';
      ctx.fillStyle = bootColor;
      ctx.beginPath(); ctx.roundRect(-w * 0.22, h * 0.12, w * 0.26, h * 0.42, 3); ctx.fill();
      ctx.fillStyle = cuffColor;
      ctx.fillRect(-w * 0.24, h * 0.12, w * 0.3, h * 0.1);
      ctx.fillStyle = bootColor;
      ctx.beginPath(); ctx.roundRect(w * 0.0 - legSwing, h * 0.1, w * 0.26, h * 0.44, 3); ctx.fill();
      ctx.fillStyle = cuffColor;
      ctx.fillRect(w * 0.0 - legSwing - 0.02 * w, h * 0.1, w * 0.3, h * 0.1);
    } else {
      // Stade 0 : petites pattes arrondies (chaton)
      ctx.fillStyle = st.earColor;
      ctx.beginPath(); ctx.ellipse(-w * 0.12, h * 0.42, w * 0.16, h * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse( w * 0.12 - legSwing * 0.5, h * 0.44, w * 0.16, h * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    }

    // ── Body ──
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.04, w * 0.42, h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Chest / belly
    ctx.fillStyle = hurt ? '#ffe0e0' : st.bellyColor;
    ctx.beginPath();
    ctx.ellipse(w * 0.04, h * 0.08, w * 0.22, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belt sash (stade 1+ seulement)
    if (player.evolution >= 1) {
      ctx.strokeStyle = '#8B6020'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-w * 0.3, -h * 0.08); ctx.lineTo(w * 0.2, h * 0.18); ctx.stroke();
      ctx.fillStyle = '#d4a800';
      ctx.fillRect(-w * 0.05, h * 0.03, 8, 5);
    }

    // Tiger stripes (stage 2)
    if (player.evolution === 2) {
      ctx.strokeStyle = '#a03000'; ctx.lineWidth = 2;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(s * 5, -h * 0.1); ctx.lineTo(s * 10, h * 0.08); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * 3, h * 0.1);  ctx.lineTo(s * 9, h * 0.22); ctx.stroke();
      }
    }

    // ── Head ──
    const hcx = w * 0.1, hcy = -h * 0.3, hr = h * 0.28;
    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.arc(hcx, hcy, hr, 0, Math.PI * 2); ctx.fill();

    // ── Ears ──
    ctx.fillStyle = st.earColor;
    ctx.beginPath(); ctx.moveTo(hcx - hr * 0.55, hcy - hr * 0.45);
    ctx.lineTo(hcx - hr * 0.85, hcy - hr * 1.15); ctx.lineTo(hcx - hr * 0.1, hcy - hr * 0.6);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hcx + hr * 0.35, hcy - hr * 0.5);
    ctx.lineTo(hcx + hr * 0.72, hcy - hr * 1.1); ctx.lineTo(hcx + hr * 0.85, hcy - hr * 0.35);
    ctx.closePath(); ctx.fill();

    // ── Chapeau (stade 1+) ou nœud chaton (stade 0) ──
    if (player.evolution >= 1) {
      // Chapeau Chat Potté
      const hatColor = player.evolution === 2 ? '#0a0a0a' : '#1a1a1a';
      ctx.fillStyle = hatColor;
      ctx.beginPath(); ctx.ellipse(hcx - hr * 0.05, hcy - hr * 0.7, hr * 0.65, hr * 0.55, -0.08, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(hcx - hr * 0.05, hcy - hr * 0.22, hr * 1.5, hr * 0.22, 0.05, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = player.evolution === 2 ? '#ff8800' : '#c4960a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(hcx - hr * 0.05, hcy - hr * 0.3, hr * 0.64, hr * 0.14, -0.08, 0, Math.PI * 2); ctx.stroke();
      // Plume
      const plumeColor = player.evolution === 2 ? '#ff4400' : '#cc2020';
      ctx.strokeStyle = plumeColor; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hcx + hr * 0.55, hcy - hr * 0.4); ctx.quadraticCurveTo(hcx + hr * 1.3, hcy - hr * 1.8, hcx + hr * 0.6, hcy - hr * 2.1); ctx.stroke();
      ctx.strokeStyle = player.evolution === 2 ? '#ffaa00' : '#ff5555'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(hcx + hr * 0.65, hcy - hr * 0.45); ctx.quadraticCurveTo(hcx + hr * 1.45, hcy - hr * 1.85, hcx + hr * 0.7, hcy - hr * 2.15); ctx.stroke();
      ctx.lineCap = 'butt';
    } else {
      // Stade 0 : petit nœud rose sur la tête (chaton)
      const bx = hcx - hr * 0.05, by = hcy - hr * 1.05;
      ctx.fillStyle = '#ff88cc';
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.bezierCurveTo(bx - 10, by - 6, bx - 12, by + 6, bx, by + 2); ctx.bezierCurveTo(bx + 12, by + 6, bx + 10, by - 6, bx, by); ctx.fill();
      ctx.fillStyle = '#ff44aa';
      ctx.beginPath(); ctx.arc(bx, by + 1, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    // ── BIG Eyes (signature Puss in Boots!) ──
    const elx = hcx - hr * 0.3, erx = hcx + hr * 0.32, ey = hcy + hr * 0.05;
    const ew = hr * 0.28, eh = hr * 0.34;

    if (hurt) {
      ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
      for (const ex2 of [elx, erx]) {
        ctx.beginPath(); ctx.moveTo(ex2 - 5, ey - 4); ctx.lineTo(ex2 + 5, ey + 4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex2 + 5, ey - 4); ctx.lineTo(ex2 - 5, ey + 4); ctx.stroke();
      }
    } else if (attacking) {
      // Fierce squinted eyes
      ctx.fillStyle = '#1a6600';
      for (const ex2 of [elx, erx]) {
        ctx.beginPath(); ctx.ellipse(ex2, ey, ew * 0.9, eh * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
      for (const ex2 of [elx, erx]) {
        ctx.beginPath(); ctx.moveTo(ex2 - ew, ey - eh * 0.5); ctx.lineTo(ex2 + ew, ey - eh * 0.1); ctx.stroke();
      }
    } else {
      // Big round pleading eyes
      // Whites
      ctx.fillStyle = '#f8f2e0';
      ctx.beginPath(); ctx.ellipse(elx, ey, ew, eh, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(erx, ey, ew, eh, 0, 0, Math.PI * 2); ctx.fill();
      // Iris (vivid green)
      ctx.fillStyle = '#1a9400';
      ctx.beginPath(); ctx.ellipse(elx, ey, ew * 0.72, eh * 0.82, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(erx, ey, ew * 0.72, eh * 0.82, 0, 0, Math.PI * 2); ctx.fill();
      // Vertical cat pupil
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.ellipse(elx, ey, ew * 0.2, eh * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(erx, ey, ew * 0.2, eh * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      // Eyeshine
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.ellipse(elx - ew * 0.2, ey - eh * 0.3, ew * 0.18, eh * 0.22, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(erx - ew * 0.2, ey - eh * 0.3, ew * 0.18, eh * 0.22, -0.4, 0, Math.PI * 2); ctx.fill();
    }

    // ── Nose ──
    ctx.fillStyle = '#ff8899';
    ctx.beginPath(); ctx.arc(hcx + hr * 0.06, hcy + hr * 0.32, hr * 0.1, 0, Math.PI * 2); ctx.fill();

    // ── Whiskers ──
    ctx.strokeStyle = 'rgba(255,255,255,0.72)'; ctx.lineWidth = 0.9;
    for (const side of [-1, 1]) {
      for (const off of [-0.12, 0, 0.12]) {
        ctx.beginPath();
        ctx.moveTo(hcx + hr * 0.06, hcy + hr * 0.32 + off * hr);
        ctx.lineTo(hcx + side * hr * 1.3, hcy + hr * 0.28 + off * hr * 1.4);
        ctx.stroke();
      }
    }

    // ── Tail ──
    ctx.strokeStyle = st.earColor; ctx.lineWidth = 3; ctx.lineCap = 'round';
    const tailSwing = isMoving ? Math.sin(tick * 0.2) * 14 : Math.sin(tick * 0.05) * 7;
    ctx.beginPath();
    ctx.moveTo(-w * 0.38, h * 0.08);
    ctx.bezierCurveTo(-w * 0.95, -h * 0.05, -w * 1.15 + tailSwing, -h * 0.28, -w * 0.92 + tailSwing * 1.4, -h * 0.48);
    ctx.stroke();
    ctx.fillStyle = st.earColor;
    ctx.beginPath(); ctx.arc(-w * 0.92 + tailSwing * 1.4, -h * 0.48, 4, 0, Math.PI * 2); ctx.fill();
    ctx.lineCap = 'butt';

    // ── Attaque ──
    if (attacking) {
      const alpha = player.attackTimer / 16;
      ctx.save(); ctx.globalAlpha = alpha;
      if (player.evolution === 0) {
        // Stade 0 : coup de patte
        ctx.fillStyle = st.color;
        ctx.beginPath(); ctx.arc(w * 0.58, -h * 0.06, w * 0.24, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
        for (let ci = -1; ci <= 1; ci++) {
          ctx.beginPath(); ctx.moveTo(w * 0.74, -h * 0.06 + ci * 5); ctx.lineTo(w * 0.9, -h * 0.06 + ci * 7); ctx.stroke();
        }
        ctx.lineCap = 'butt';
      } else if (player.evolution === 1) {
        // Stade 1 : épée
        ctx.strokeStyle = '#c8d8e8'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(w * 0.35, -h * 0.1); ctx.lineTo(w * 0.35 + 28, -h * 0.1 - 22); ctx.stroke();
        ctx.strokeStyle = '#d4a800'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(w * 0.35 + 7, -h * 0.1 - 8); ctx.lineTo(w * 0.35 + 20, -h * 0.1 - 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(200,240,255,0.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(w * 0.3, -h * 0.1, 26, -Math.PI * 0.75, -Math.PI * 0.05); ctx.stroke();
        ctx.lineCap = 'butt';
      } else {
        // Stade 2 : pose de lancer de chaton
        ctx.strokeStyle = st.color; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(w * 0.1, -h * 0.05); ctx.lineTo(w * 0.58, -h * 0.36); ctx.stroke();
        ctx.lineCap = 'butt';
        // Petit chaton dans la paume
        ctx.fillStyle = '#f0a844';
        ctx.beginPath(); ctx.arc(w * 0.6, -h * 0.38, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e08030';
        ctx.beginPath(); ctx.moveTo(w * 0.55, -h * 0.43); ctx.lineTo(w * 0.53, -h * 0.49); ctx.lineTo(w * 0.58, -h * 0.43); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(w * 0.63, -h * 0.44); ctx.lineTo(w * 0.66, -h * 0.50); ctx.lineTo(w * 0.68, -h * 0.44); ctx.closePath(); ctx.fill();
        // Arc de trajectoire (pointillés)
        ctx.strokeStyle = 'rgba(255,200,100,0.5)'; ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(w * 0.6, -h * 0.1, 36, -Math.PI * 0.85, -Math.PI * 0.15); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    // ── Aura selon stade ──
    if (player.evolution === 1) {
      // Stade 1 : halo doré discret
      ctx.globalAlpha = 0.07 + Math.sin(tick * 0.06) * 0.03;
      ctx.strokeStyle = '#ffcc44'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, 0, w * 0.82, h * 0.82, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (player.evolution === 2) {
      // Stade 2 : aura de feu (anneaux multiples)
      for (let ri = 3; ri >= 1; ri--) {
        ctx.globalAlpha = (0.09 + Math.sin(tick * 0.09 + ri) * 0.04) / ri;
        ctx.strokeStyle = ri === 1 ? '#ff8800' : ri === 2 ? '#ff4400' : '#ff0000';
        ctx.lineWidth = 2 + ri;
        ctx.beginPath(); ctx.ellipse(0, 0, w * (0.72 + ri * 0.18), h * (0.72 + ri * 0.18), 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  _drawHUD() {
    const ctx = this.ctx;
    if (!this.player) return;
    const p = this.player;

    // ── Top-left: Lives ──
    ctx.save();
    for (let i = 0; i < p.lives; i++) {
      this._drawMiniCat(20 + i * 28, 14);
    }
    ctx.restore();

    // Score
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${p.score}`, 20, 50);

    // ── Top-right: Level + Stage ──
    const lvl = this.currentLevel;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`Niveau ${lvl.num}/5 — ${lvl.name}`, this.W - 16, 24);

    const stageColor = p.stage.color;
    ctx.fillStyle = stageColor;
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`Stage: ${p.stage.name}`, this.W - 16, 44);

    // ── Fish progress bar (bottom center, if not max stage) ──
    if (p.evolution < 2) {
      const nextThresh = FISH_THRESHOLDS[p.evolution];
      const prevThresh = p.evolution === 0 ? 0 : FISH_THRESHOLDS[p.evolution - 1];
      const fishProgress = (p.totalFish - prevThresh) / (nextThresh - prevThresh);
      const barW = 200, barH = 16;
      const bx = this.W / 2 - barW / 2;
      const by = this.H - 36;

      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);
      ctx.fillStyle = '#333';
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = '#2266cc';
      ctx.fillRect(bx, by, Math.min(barW * fishProgress, barW), barH);
      ctx.strokeStyle = '#88aaff';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, barW, barH);

      ctx.fillStyle = '#fff';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Poissons: ${p.totalFish}/${nextThresh}`, this.W / 2, by + 12);
    }

    ctx.textAlign = 'left';

    // Power-up timers
    const player = this.player;
    if (player.evolutionBoost > 0) {
      const pct = player.evolutionBoost / 600;
      const bx = this.W - 120;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx, 10, 108, 18);
      ctx.fillStyle = '#cc3300';
      ctx.fillRect(bx + 2, 12, Math.round(104 * pct), 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.min(12, this.W / 50)}px monospace`;
      ctx.fillText('MUSH', bx + 4, 23);
    }
    if (player.bootTimer > 0) {
      const pct = player.bootTimer / 480;
      const bx = this.W - 120;
      const by = player.evolutionBoost > 0 ? 32 : 10;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx, by, 108, 18);
      ctx.fillStyle = '#d4a020';
      ctx.fillRect(bx + 2, by + 2, Math.round(104 * pct), 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.min(12, this.W / 50)}px monospace`;
      ctx.fillText('BOOT', bx + 4, by + 13);
    }

    // ── Evolution message ──
    if (this.showEvolveMsg > 0) {
      const alpha = Math.min(1, this.showEvolveMsg / 30);
      const scale = 1 + (1 - this.showEvolveMsg / 180) * 0.4;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(this.W / 2, this.H / 2 - 60);
      ctx.scale(scale, scale);
      ctx.textAlign = 'center';
      ctx.font = 'bold 36px monospace';
      ctx.fillStyle = '#ffee00';
      ctx.shadowColor = '#ff8800';
      ctx.shadowBlur = 16;
      ctx.fillText('EVOLUTION !', 0, 0);
      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(this.player.stage.name, 0, 34);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // ── Checkpoint message ──
    if (this.showCheckpointMsg > 0) {
      const alpha = Math.min(1, this.showCheckpointMsg / 30);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#00ff88';
      ctx.font = `bold ${Math.min(28, this.W / 16)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('CHECKPOINT!', this.W / 2, this.H / 2 - 60);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }
  }

  _drawMiniCat(x, y) {
    const ctx = this.ctx;
    ctx.fillStyle = '#f0a844';
    ctx.beginPath();
    ctx.arc(x + 8, y + 8, 8, 0, Math.PI * 2);
    ctx.fill();
    // Ears
    ctx.fillStyle = '#e08030';
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 3);
    ctx.lineTo(x + 2, y - 3);
    ctx.lineTo(x + 8, y + 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 13, y + 3);
    ctx.lineTo(x + 15, y - 3);
    ctx.lineTo(x + 10, y + 2);
    ctx.closePath();
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(x + 6, y + 8, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 10, y + 8, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ───────────────────────────── MENUS ───────────────────────

  _drawProjectile(proj) {
    const ctx = this.ctx;
    const dir = proj.vx > 0 ? 1 : -1;
    ctx.save();
    ctx.translate(proj.x + proj.w / 2, proj.y + proj.h / 2);
    if (dir < 0) ctx.scale(-1, 1);
    ctx.rotate(Math.atan2(proj.vy, Math.abs(proj.vx)) * 0.4);

    // Sillage
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#f0a844';
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath(); ctx.arc(-i * 7, 0, 8 - i * 1.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Tête de chaton
    ctx.fillStyle = '#f0a844';
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    // Oreilles
    ctx.fillStyle = '#e08030';
    ctx.beginPath(); ctx.moveTo(-5, -7); ctx.lineTo(-9, -14); ctx.lineTo(-1, -7); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(4, -7); ctx.lineTo(9, -14); ctx.lineTo(1, -7); ctx.closePath(); ctx.fill();
    // Yeux
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(-3, -1, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3, -1, 1.5, 0, Math.PI * 2); ctx.fill();
    // Nez
    ctx.fillStyle = '#ff8899';
    ctx.beginPath(); ctx.arc(0, 2, 1, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  // ── Leaderboard ───────────────────────────────────────────────
  _loadLeaderboard() {
    try { return JSON.parse(localStorage.getItem('chatArcade_lb') || '[]'); } catch { return []; }
  }

  _saveScore(name, score, evolutionIdx, levelNum) {
    const lb = this._loadLeaderboard();
    lb.push({ name, score, stage: CAT_STAGES[evolutionIdx].name, level: levelNum, date: new Date().toLocaleDateString('fr-FR') });
    lb.sort((a, b) => b.score - a.score);
    lb.splice(10);
    localStorage.setItem('chatArcade_lb', JSON.stringify(lb));
    this._lb = lb;
  }

  _showScoreEntry(score, evolutionIdx, levelIdx) {
    if (this._scoreEntryEl) return;
    const savedName = localStorage.getItem('chatArcade_name') || '';
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:200;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:monospace;color:#fff;';
    el.innerHTML = `
      <div style="text-align:center;padding:24px;max-width:340px;width:90%;">
        <div style="font-size:clamp(20px,5vw,28px);font-weight:bold;color:#ffee00;margin-bottom:6px;">🏆 Score : ${score}</div>
        <div style="font-size:clamp(14px,3.5vw,18px);color:#aaa;margin-bottom:20px;">Stade : ${CAT_STAGES[evolutionIdx].name} — Niv.${levelIdx + 1}</div>
        <div style="font-size:clamp(14px,3.5vw,18px);margin-bottom:12px;">Entrez votre nom :</div>
        <input id="se-name" type="text" maxlength="12" value="${savedName}"
          style="font-size:clamp(16px,4vw,22px);padding:10px 16px;border-radius:10px;border:2px solid #888;text-align:center;width:100%;box-sizing:border-box;margin-bottom:18px;background:#222;color:#fff;">
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
          <button id="se-save" style="font-size:clamp(14px,3.5vw,18px);padding:12px 24px;background:#44aa44;border:none;border-radius:10px;color:white;cursor:pointer;font-family:monospace;">💾 Sauvegarder</button>
          <button id="se-skip" style="font-size:clamp(14px,3.5vw,18px);padding:12px 24px;background:#555;border:none;border-radius:10px;color:white;cursor:pointer;font-family:monospace;">Ignorer</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    this._scoreEntryEl = el;
    setTimeout(() => { const inp = document.getElementById('se-name'); if (inp) inp.focus(); }, 80);
    const done = (save) => {
      if (save) {
        const name = (document.getElementById('se-name').value || 'Anonyme').trim().substring(0, 12);
        localStorage.setItem('chatArcade_name', name);
        this._saveScore(name, score, evolutionIdx, levelIdx + 1);
      }
      document.body.removeChild(el);
      this._scoreEntryEl = null;
      this.state = 'menu';
    };
    document.getElementById('se-save').onclick = () => done(true);
    document.getElementById('se-skip').onclick  = () => done(false);
  }

  _drawMenu() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;

    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a0010');
    grad.addColorStop(1, '#1a0820');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 60; i++) {
      const sx = (i * 137.5) % W;
      const sy = (i * 93.7) % (H * 0.7);
      const ss = 0.5 + (i % 3) * 0.5;
      ctx.globalAlpha = 0.4 + Math.sin(Date.now() * 0.002 + i) * 0.3;
      ctx.beginPath();
      ctx.arc(sx, sy, ss, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Title (responsive)
    const titleSize = Math.min(72, W / 7.5);
    ctx.shadowColor = '#ff6600'; ctx.shadowBlur = 30;
    ctx.textAlign = 'center';
    ctx.font = `bold ${titleSize}px monospace`;
    ctx.fillStyle = '#f0a844';
    ctx.fillText('CHAT ARCADE', W / 2, H * 0.22);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.font = `bold ${Math.min(22, W / 17)}px monospace`;
    ctx.fillStyle = '#ffd090';
    ctx.fillText('Platformer Félin 2D', W / 2, H * 0.31);

    // Cat mascot
    this._drawMenuCat(W / 2, H * 0.48);

    // Press Enter / Touch
    const blink = Math.floor(Date.now() / 600) % 2 === 0;
    ctx.font = `bold ${Math.min(24, W / 14)}px monospace`;
    ctx.fillStyle = blink ? '#ffffff' : '#aaaaaa';
    ctx.fillText('Touchez l\'écran  /  ENTRÉE', W / 2, H * 0.66);

    // Controls (adapted to screen width)
    ctx.font = `${Math.min(13, W / 28)}px monospace`;
    ctx.fillStyle = '#777';
    if (W >= 500) {
      ctx.fillText('←→ Déplacer  ↑/Espace Saut  Z Attaque  Shift Dash', W / 2, H * 0.72);
      ctx.fillText('6 🐟 → Chat (épée)   16 🐟 → Chat Tigré (chatons)', W / 2, H * 0.755);
    } else {
      ctx.fillText('Joystick droit • Bouton gauche : Attaque', W / 2, H * 0.72);
      ctx.fillText('6 🐟 → Chat   16 🐟 → Chat Tigré', W / 2, H * 0.755);
    }

    // Leaderboard top 5
    if (this._lb && this._lb.length > 0) {
      const lbY = H * 0.80;
      ctx.font = `bold ${Math.min(14, W / 24)}px monospace`;
      ctx.fillStyle = '#ffcc44';
      ctx.fillText('🏆 Top Scores', W / 2, lbY);
      ctx.font = `${Math.min(12, W / 28)}px monospace`;
      const show = Math.min(5, this._lb.length);
      for (let i = 0; i < show; i++) {
        const e = this._lb[i];
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
        ctx.fillStyle = i === 0 ? '#ffee00' : '#aaaaaa';
        ctx.fillText(`${medal} ${e.name.substring(0,10).padEnd(10)}  ${e.score}  Niv.${e.level}`, W / 2, lbY + 18 + i * 16);
      }
    }

    ctx.textAlign = 'left';
  }

  _drawMenuCat(cx, cy) {
    const ctx = this.ctx;
    const t = Date.now() * 0.003;
    const bob = Math.sin(t) * 6;

    ctx.save();
    ctx.translate(cx, cy + bob);

    // Cape (behind body)
    ctx.fillStyle = '#8B1010';
    ctx.beginPath();
    ctx.moveTo(-14, -8);
    ctx.quadraticCurveTo(-52, 10 + Math.sin(t * 0.8) * 5, -38, 38 + Math.sin(t * 0.8) * 3);
    ctx.lineTo(-6, 30);
    ctx.lineTo(-6, -10);
    ctx.closePath();
    ctx.fill();

    // Boots
    ctx.fillStyle = '#3a2010';
    ctx.beginPath(); ctx.roundRect(-20, 24, 18, 28, 3); ctx.fill();
    ctx.beginPath(); ctx.roundRect(2, 22, 18, 30, 3); ctx.fill();
    ctx.fillStyle = '#5a3820';
    ctx.fillRect(-22, 24, 22, 7);
    ctx.fillRect(0, 22, 22, 7);

    // Body
    ctx.fillStyle = '#f0a844';
    ctx.beginPath();
    ctx.ellipse(0, 10, 26, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    // Belly
    ctx.fillStyle = '#ffd090';
    ctx.beginPath();
    ctx.ellipse(2, 12, 14, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    // Belt sash
    ctx.strokeStyle = '#8B6020'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-18, -2); ctx.lineTo(14, 16); ctx.stroke();
    ctx.fillStyle = '#d4a800';
    ctx.fillRect(-4, 6, 8, 5);

    // Head
    ctx.fillStyle = '#f0a844';
    ctx.beginPath();
    ctx.arc(0, -18, 26, 0, Math.PI * 2);
    ctx.fill();

    // Ears (under hat brim)
    ctx.fillStyle = '#e08030';
    ctx.beginPath(); ctx.moveTo(-16, -32); ctx.lineTo(-22, -50); ctx.lineTo(-6, -36); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(16, -32); ctx.lineTo(22, -50); ctx.lineTo(6, -36); ctx.closePath(); ctx.fill();

    // Hat brim (wide, over ears)
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.ellipse(0, -36, 42, 10, 0.05, 0, Math.PI * 2); ctx.fill();
    // Hat crown
    ctx.beginPath(); ctx.ellipse(0, -50, 22, 18, -0.05, 0, Math.PI * 2); ctx.fill();
    // Gold band
    ctx.strokeStyle = '#c4960a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, -37, 21, 5, -0.05, 0, Math.PI * 2); ctx.stroke();
    // Red feather
    ctx.strokeStyle = '#cc2020'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(18, -40);
    ctx.quadraticCurveTo(46, -70, 24, -82);
    ctx.stroke();
    ctx.strokeStyle = '#ff5555'; ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(22, -42);
    ctx.quadraticCurveTo(50, -72, 28, -84);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // BIG eyes (Puss in Boots signature)
    const ew = 9, eh = 12;
    // Whites
    ctx.fillStyle = '#f8f2e0';
    ctx.beginPath(); ctx.ellipse(-10, -20, ew, eh, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10, -20, ew, eh, 0, 0, Math.PI * 2); ctx.fill();
    // Green iris
    ctx.fillStyle = '#1a9400';
    ctx.beginPath(); ctx.ellipse(-10, -20, ew * 0.7, eh * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10, -20, ew * 0.7, eh * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    // Vertical pupil
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.ellipse(-10, -20, ew * 0.2, eh * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10, -20, ew * 0.2, eh * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    // Eyeshine
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.ellipse(-12, -23, ew * 0.22, eh * 0.25, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(8, -23, ew * 0.22, eh * 0.25, -0.4, 0, Math.PI * 2); ctx.fill();

    // Nose
    ctx.fillStyle = '#ff8899';
    ctx.beginPath(); ctx.arc(0, -11, 3.5, 0, Math.PI * 2); ctx.fill();

    // Whiskers
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 1;
    for (const side of [-1, 1]) {
      for (const off of [-4, 0, 4]) {
        ctx.beginPath();
        ctx.moveTo(side * 4, -11 + off);
        ctx.lineTo(side * 34, -12 + off * 1.5);
        ctx.stroke();
      }
    }

    // Tail
    ctx.strokeStyle = '#e08030'; ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(26, 8);
    ctx.bezierCurveTo(44, -14, 58, 8, 46, 26);
    ctx.stroke();

    ctx.restore();
  }

  _drawPause() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.min(64, W / 5)}px monospace`;
    ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#4488ff'; ctx.shadowBlur = 20;
    ctx.fillText('PAUSE', W / 2, H / 2 - 20);
    ctx.shadowBlur = 0;
    ctx.font = `${Math.min(20, W / 16)}px monospace`;
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('Touchez / Entrée / Echap : Reprendre', W / 2, H / 2 + 30);
    ctx.textAlign = 'left';
  }

  _drawGameOver() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.min(72, W / 8)}px monospace`;
    ctx.fillStyle = '#ff2222';
    ctx.shadowColor = '#880000'; ctx.shadowBlur = 24;
    ctx.fillText('GAME OVER', W / 2, H * 0.18);
    ctx.shadowBlur = 0;

    ctx.font = `bold ${Math.min(24, W / 14)}px monospace`;
    ctx.fillStyle = '#ffaa44';
    ctx.fillText(`Score : ${this.player ? this.player.score : 0}`, W / 2, H * 0.3);

    // Divider
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W / 2, H * 0.37); ctx.lineTo(W / 2, H * 0.88); ctx.stroke();

    const blink = Math.floor(Date.now() / 600) % 2 === 0;
    const lvlName = this.currentLevel ? this.currentLevel.name : '';

    // ── Option gauche : Recommencer Niveau 1 ──
    ctx.fillStyle = 'rgba(200,50,50,0.12)';
    ctx.fillRect(0, H * 0.36, W / 2, H * 0.54);

    ctx.font = `bold ${Math.min(20, W / 18)}px monospace`;
    ctx.fillStyle = '#ff6644';
    ctx.fillText('Recommencer', W / 4, H * 0.48);
    ctx.font = `${Math.min(16, W / 22)}px monospace`;
    ctx.fillStyle = '#ffaa88';
    ctx.fillText('Niveau 1 — 3 vies', W / 4, H * 0.56);
    // mini cœurs
    for (let i = 0; i < 3; i++) this._drawMiniHeart(W / 4 - 22 + i * 22, H * 0.62);
    ctx.font = `${Math.min(13, W / 26)}px monospace`;
    ctx.fillStyle = blink ? '#fff' : '#777';
    ctx.fillText('◀ Gauche / Entrée', W / 4, H * 0.74);

    // ── Option droite : Continuer niveau actuel ──
    ctx.fillStyle = 'rgba(50,100,220,0.12)';
    ctx.fillRect(W / 2, H * 0.36, W / 2, H * 0.54);

    ctx.font = `bold ${Math.min(20, W / 18)}px monospace`;
    ctx.fillStyle = '#4488ff';
    ctx.fillText('Continuer', W * 3 / 4, H * 0.48);
    ctx.font = `${Math.min(16, W / 22)}px monospace`;
    ctx.fillStyle = '#88aaff';
    ctx.fillText(`${lvlName} — 1 vie`, W * 3 / 4, H * 0.56);
    this._drawMiniHeart(W * 3 / 4, H * 0.62);
    ctx.font = `${Math.min(13, W / 26)}px monospace`;
    ctx.fillStyle = blink ? '#fff' : '#777';
    ctx.fillText('Droite / N', W * 3 / 4, H * 0.74);

    ctx.textAlign = 'left';
  }

  _drawMiniHeart(x, y, size = 9) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#ff2255';
    ctx.beginPath();
    ctx.moveTo(0, size * 0.35);
    ctx.bezierCurveTo(0, 0, -size, 0, -size, size * 0.35);
    ctx.bezierCurveTo(-size, size * 0.75, 0, size * 1.3, 0, size * 1.6);
    ctx.bezierCurveTo(0, size * 1.3, size, size * 0.75, size, size * 0.35);
    ctx.bezierCurveTo(size, 0, 0, 0, 0, size * 0.35);
    ctx.fill();
    ctx.restore();
  }

  _drawWin() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;

    // Confetti
    for (const c of this.confetti) {
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot);
      ctx.fillStyle = c.color; ctx.globalAlpha = 0.85;
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.min(60, W / 6)}px monospace`;
    ctx.fillStyle = '#ffee00'; ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 30;
    ctx.fillText('FELICITATIONS !', W / 2, H * 0.22);
    ctx.shadowBlur = 0;

    ctx.font = `bold ${Math.min(24, W / 14)}px monospace`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Vous avez sauvé le quartier !', W / 2, H * 0.35);

    ctx.font = `bold ${Math.min(22, W / 15)}px monospace`;
    ctx.fillStyle = '#ffaa44';
    ctx.fillText(`Score final : ${this.player ? this.player.score : 0}`, W / 2, H * 0.45);

    const stageName = this.player ? this.player.stage.name : '';
    ctx.font = `${Math.min(18, W / 18)}px monospace`;
    ctx.fillStyle = '#ffd090';
    ctx.fillText(`Stade : ${stageName}`, W / 2, H * 0.54);

    // Leaderboard top 3
    if (this._lb && this._lb.length > 0) {
      ctx.font = `bold ${Math.min(14, W / 24)}px monospace`;
      ctx.fillStyle = '#ffcc44';
      ctx.fillText('🏆 Meilleurs scores', W / 2, H * 0.65);
      ctx.font = `${Math.min(12, W / 28)}px monospace`;
      for (let i = 0; i < Math.min(3, this._lb.length); i++) {
        const e = this._lb[i];
        ctx.fillStyle = i === 0 ? '#ffee00' : '#aaa';
        ctx.fillText(`${i+1}. ${e.name}  ${e.score}`, W / 2, H * 0.69 + i * 16);
      }
    }

    const blink = Math.floor(Date.now() / 700) % 2 === 0;
    ctx.font = `${Math.min(18, W / 18)}px monospace`;
    ctx.fillStyle = blink ? '#ffffff' : '#888888';
    ctx.fillText('Touchez l\'écran / ENTRÉE pour rejouer', W / 2, H * 0.88);
    ctx.textAlign = 'left';
  }
}

// Start the game
window.addEventListener('load', () => {
  new Game();
});
