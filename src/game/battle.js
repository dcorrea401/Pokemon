export class Battle {
  constructor(playerTrainer, wildPokemon){
    this.player = playerTrainer;
    this.wild = JSON.parse(JSON.stringify(wildPokemon));
    this.onEnd = null;
    // give player first pokemon from list if exists
    this.playerPkm = (this.player.pokemon && this.player.pokemon[0]) ? JSON.parse(JSON.stringify(this.player.pokemon[0])) : {name:'Missing',hp:10,maxHp:10,attack:2};
    this.playerPkm.hp = this.playerPkm.hp || this.playerPkm.maxHp || 10;
    this.playerPkm.maxHp = this.playerPkm.maxHp || this.playerPkm.hp;
    this.wild.hp = this.wild.hp || this.wild.maxHp || 10;
    this.wild.maxHp = this.wild.maxHp || this.wild.hp;
    this.state = 'intro';
    this.choice = 0; // 0: Fight, 1: Run
    this.attackChoice = 0; // Selected attack in fight menu
    this.log = '';
    this._bound = false;
    this.menuIndex = 0;
    this.switchIndex = 0;
    this.itemIndex = 0;
    // Animation system
    this.attackAnimation = null; // { startTime, duration, attacker, isPlayer }
    this.canvasRef = null; // Reference to canvas for click detection
  }
  update(dt){
    // simple input handling
    // arrow keys to change choice, Enter to confirm
    // attach once
    if(!this._bound){
      this._bound = true;
      
      // Get canvas reference for click detection
      const canvas = document.querySelector('canvas');
      this.canvasRef = canvas;
      
      // Add mouse click listener for menu buttons
      if(canvas){
        canvas.addEventListener('click', (e) => this._handleCanvasClick(e));
      }
      
      window.addEventListener('keydown', (e)=>{
        // global: handle based on current state
        if(this.state === 'menu_attack'){
          const attacks = this._getAvailableAttacks(this.playerPkm);
          const len = attacks.length;
          if(e.key==='ArrowLeft' || e.key==='ArrowUp') this.attackChoice = (this.attackChoice - 1 + len) % len;
          else if(e.key==='ArrowRight' || e.key==='ArrowDown') this.attackChoice = (this.attackChoice + 1) % len;
          else if(e.key==='Enter'){
            this._executeAttack(attacks[this.attackChoice]);
          } else if(e.key==='Escape'){
            this.state='fight';
            this.attackChoice = 0;
          }
          return;
        }
        if(this.state === 'menu_switch'){
          const len = (this.player.pokemon||[]).length;
          if(e.key==='ArrowLeft' || e.key==='ArrowUp') this.switchIndex = (this.switchIndex - 1 + len) % len;
          else if(e.key==='ArrowRight' || e.key==='ArrowDown') this.switchIndex = (this.switchIndex + 1) % len;
          else if(e.key==='Enter'){
            this._confirmSwitch(this.switchIndex);
          } else if(e.key==='Escape'){
            this.state='fight';
          }
          return;
        }
        if(this.state === 'menu_item'){
          const items = (this.player.items||[]).filter(it=>it.count>0);
          const len = items.length;
          if(len===0){ if(e.key==='Escape') this.state='fight'; return; }
          if(e.key==='ArrowLeft' || e.key==='ArrowUp') this.itemIndex = (this.itemIndex - 1 + len) % len;
          else if(e.key==='ArrowRight' || e.key==='ArrowDown') this.itemIndex = (this.itemIndex + 1) % len;
          else if(e.key==='Enter'){
            this._useItem(items[this.itemIndex]);
          } else if(e.key==='Escape'){
            this.state='fight';
          }
          return;
        }
        // normal fight menu
        if(this.state !== 'fight' && this.state !== 'intro') return;
        if(e.key==='ArrowLeft'){
          // move left in 2x2 grid
          this.choice = (this.choice % 2 === 0) ? (this.choice + 1) : (this.choice - 1);
        } else if(e.key==='ArrowRight'){
          this.choice = (this.choice % 2 === 0) ? (this.choice + 1) : (this.choice - 1);
        } else if(e.key==='ArrowUp'){
          this.choice = (this.choice < 2) ? this.choice + 2 : this.choice - 2;
        } else if(e.key==='ArrowDown'){
          this.choice = (this.choice < 2) ? this.choice + 2 : this.choice - 2;
        } else if(e.key==='Enter'){
          if(this.choice===0) { this.state='menu_attack'; this.attackChoice = 0; }
          else if(this.choice===1) this._runAttempt();
          else if(this.choice===2) { this.state='menu_switch'; this.switchIndex = 0; }
          else if(this.choice===3) { this.state='menu_item'; this.itemIndex = 0; }
        }
      });
      // start fight after intro
      setTimeout(()=>{ this.state='fight'; this.log='¡Un '+this.wild.name+' salvaje apareció!'; }, 600);
    }
  }

  // Allow external UI clicks to trigger actions
  handleAction(index){
    // Disable all actions during animation
    if(this.isAnimating()) return;
    
    if(this.state === 'menu_attack'){
      // Click on an attack
      const attacks = this._getAvailableAttacks(this.playerPkm);
      if(index >= 0 && index < attacks.length){
        this._executeAttack(attacks[index]);
      }
      return;
    }
    if(this.state === 'menu_switch'){
      // when in switch menu, treat index as party index
      this._confirmSwitch(index);
      return;
    }
    if(this.state === 'menu_item'){
      // use item by visible index
      const items = (this.player.items||[]).filter(it=>it.count>0);
      if(index >=0 && index < items.length) this._useItem(items[index]);
      return;
    }
    // normal fight menu
    if(index===0) this._playerAttack();
    else if(index===1) this._runAttempt();
    else if(index===2) { this.state='menu_switch'; this.switchIndex = 0; }
    else if(index===3) { this.state='menu_item'; this.itemIndex = 0; }
  }

  // Handle mouse clicks on canvas menu buttons
  _handleCanvasClick(e){
    if(!this.canvasRef) return;
    
    const rect = this.canvasRef.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Scale click coordinates to canvas size
    const scaleX = this.canvasRef.width / rect.width;
    const scaleY = this.canvasRef.height / rect.height;
    const x = clickX * scaleX;
    const y = clickY * scaleY;
    
    const w = this.canvasRef.width;
    const h = this.canvasRef.height;
    
    if(this.state === 'menu_attack'){
      // Check if click is on any attack button
      const attacks = this._getAvailableAttacks(this.playerPkm);
      const menuW = 300;
      const menuH = Math.min(400, attacks.length * 50 + 60);
      const menuX = w/2 - menuW/2;
      const menuY = h - menuH - 20;
      
      let yOffset = menuY + 30;
      for(let i = 0; i < attacks.length; i++){
        if(x >= menuX && x <= menuX + menuW && y >= yOffset && y <= yOffset + 40){
          this.attackChoice = i;
          this.handleAction(i);
          return;
        }
        yOffset += 40;
      }
    } else if(this.state === 'fight'){
      // Check if click is on any of the 4 buttons
      const menuW = 220;
      const menuH = 140;
      const menuX = w/2 - menuW/2;
      const menuY = h - menuH - 20;
      
      const buttonW = 100;
      const buttonH = 60;
      const gap = 10;
      
      for(let i = 0; i < 4; i++){
        const row = Math.floor(i / 2);
        const col = i % 2;
        const btnX = menuX + col * (buttonW + gap);
        const btnY = menuY + row * (buttonH + gap);
        
        if(x >= btnX && x <= btnX + buttonW && y >= btnY && y <= btnY + buttonH){
          this.choice = i;
          this.handleAction(i);
          return;
        }
      }
    }
  }
  _playerAttack(){
    // Old method - now replaced by menu_attack state which calls _executeAttack()
    this.state = 'menu_attack';
    this.attackChoice = 0;
  }

  _confirmSwitch(idx){
    if(idx === 0){ this.state='fight'; return; }
    const party = this.player.pokemon || [];
    if(idx < 0 || idx >= party.length) { this.state='fight'; return; }
    // swap selected into position 0
    const tmp = party[0]; party[0] = party[idx]; party[idx] = tmp;
    // update active
    this.playerPkm = JSON.parse(JSON.stringify(party[0]));
    this.playerPkm.hp = this.playerPkm.hp || this.playerPkm.maxHp;
    this.log = 'Has cambiado a ' + this.playerPkm.name + '.';
    this.state='fight';
    // switching consumes the turn: wild attacks after animation completes
    setTimeout(()=>{
      // Start wild pokemon attack animation
      this.attackAnimation = {
        startTime: performance.now(),
        duration: 1000,
        attacker: 'wild'
      };
      
      const dmg = Math.max(1, Math.floor((this.wild.attack||4) * (Math.random()*0.5+0.75)));
      this.playerPkm.hp = (this.playerPkm.hp || this.playerPkm.maxHp) - dmg;
      this.log = this.wild.name + ' atacó y hace ' + dmg + ' de daño.';
      if(this.playerPkm.hp<=0){ 
        this.log += ' Tu pokémon se debilitó.'; 
        // Wait for animation to finish before ending battle
        setTimeout(()=>{ this._endBattle(); }, this.attackAnimation.duration);
      } else {
        // After wild's animation completes, clear animation and return to fight state
        setTimeout(()=>{ this.attackAnimation = null; }, this.attackAnimation.duration);
      }
    }, 350);
  }

  _useItem(item){
    if(!item || item.count <= 0) return;
    if(item.type === 'ball'){
      item.count -= 1;
      const chance = 0.5; // simple base chance
      if(Math.random() < chance){
        this.log = '¡Has capturado a ' + this.wild.name + '!';
        // add to player's party if space
        if((this.player.pokemon||[]).length < 3){
          const copy = JSON.parse(JSON.stringify(this.wild));
          this.player.pokemon.push({ id: copy.id, name: copy.name, hp: copy.hp, maxHp: copy.maxHp, attack: copy.attack });
        }
        this._endBattle();
      } else {
        this.log = 'Falló la captura.';
        // wild attacks with animation
        setTimeout(()=>{
          // Start wild pokemon attack animation
          this.attackAnimation = {
            startTime: performance.now(),
            duration: 1000,
            attacker: 'wild'
          };
          
          const dmg = Math.max(1, Math.floor((this.wild.attack||4) * (Math.random()*0.5+0.75)));
          this.playerPkm.hp = (this.playerPkm.hp || this.playerPkm.maxHp) - dmg;
          this.log = this.wild.name + ' atacó y hace ' + dmg + ' de daño.';
          if(this.playerPkm.hp<=0){ 
            this.log += ' Tu pokémon se debilitó.'; 
            // Wait for animation to finish before ending battle
            setTimeout(()=>{ this._endBattle(); }, this.attackAnimation.duration);
          } else {
            // After wild's animation completes, clear animation and return to fight state
            setTimeout(()=>{ this.attackAnimation = null; }, this.attackAnimation.duration);
          }
        },300);
      }
      this.state='fight';
      return;
    }
    if(item.type === 'heal'){
      item.count -= 1;
      const heal = item.heal || 20;
      this.playerPkm.hp = Math.min(this.playerPkm.maxHp, (this.playerPkm.hp || this.playerPkm.maxHp) + heal);
      this.log = this.playerPkm.name + ' recuperó ' + heal + ' HP.';
      // consuming item uses the turn: wild attacks with animation
      setTimeout(()=>{
        // Start wild pokemon attack animation
        this.attackAnimation = {
          startTime: performance.now(),
          duration: 1000,
          attacker: 'wild'
        };
        
        const dmg = Math.max(1, Math.floor((this.wild.attack||4) * (Math.random()*0.5+0.75)));
        this.playerPkm.hp = (this.playerPkm.hp || this.playerPkm.maxHp) - dmg;
        this.log = this.wild.name + ' atacó y hace ' + dmg + ' de daño.';
        if(this.playerPkm.hp<=0){ 
          this.log += ' Tu pokémon se debilitó.'; 
          // Wait for animation to finish before ending battle
          setTimeout(()=>{ this._endBattle(); }, this.attackAnimation.duration);
        } else {
          // After wild's animation completes, clear animation and return to fight state
          setTimeout(()=>{ this.attackAnimation = null; }, this.attackAnimation.duration);
        }
      },300);
      this.state='fight';
      return;
    }
  }

  // Get available attacks for a pokemon
  _getAvailableAttacks(pokemon){
    const attacks = [];
    // All pokemon have "Garrazo" (scratch) as basic attack
    attacks.push({ name: 'Garrazo', type: 'Normal', power: 40 });
    
    // Add special attack based on type
    if(pokemon.type && pokemon.type.length > 0){
      const primaryType = pokemon.type[0];
      if(primaryType === 'Fire') attacks.push({ name: 'Fuego', type: 'Fire', power: 60 });
      else if(primaryType === 'Water') attacks.push({ name: 'Agua', type: 'Water', power: 60 });
      else if(primaryType === 'Grass') attacks.push({ name: 'Planta', type: 'Grass', power: 60 });
      else if(primaryType === 'Flying') attacks.push({ name: 'Viento', type: 'Flying', power: 60 });
      // Add more types as needed
    }
    
    return attacks;
  }

  // Calculate type effectiveness multiplier
  _getTypeEffectiveness(attackType, defenseTypes){
    // defenseTypes is an array like ["Normal"] or ["Normal", "Flying"]
    if(!defenseTypes || defenseTypes.length === 0) return 1;
    
    let multiplier = 1;
    
    // Check against each defense type
    for(const defType of defenseTypes){
      let typeMultiplier = 1;
      
      if(attackType === 'Fire'){
        if(defType === 'Grass') typeMultiplier = 2; // Fire is strong against Grass
        else if(defType === 'Water') typeMultiplier = 0.5; // Fire is weak against Water
      } else if(attackType === 'Water'){
        if(defType === 'Fire') typeMultiplier = 2;
        else if(defType === 'Grass') typeMultiplier = 0.5;
      } else if(attackType === 'Grass'){
        if(defType === 'Water') typeMultiplier = 2;
        else if(defType === 'Fire') typeMultiplier = 0.5;
      }
      // Normal and Flying types have no advantages
      
      // Take the worst matchup (if any type is weak, use lowest multiplier)
      // But also consider stacking - for dual types we'll use the multiplier
      multiplier *= typeMultiplier;
    }
    
    return multiplier;
  }

  // Execute a specific attack
  _executeAttack(attack){
    // Start animation
    this.attackAnimation = {
      startTime: performance.now(),
      duration: 1000,
      attacker: 'player'
    };
    
    // Calculate damage with type effectiveness
    const baseDamage = attack.power || 40;
    const effectiveness = this._getTypeEffectiveness(attack.type, this.wild.type);
    const variability = Math.random() * 0.5 + 0.75; // 0.75 - 1.25
    const dmg = Math.max(1, Math.floor(baseDamage * effectiveness * variability));
    
    this.wild.hp = (this.wild.hp || this.wild.maxHp) - dmg;
    const effectMsg = effectiveness > 1 ? ' ¡Es muy efectivo!' : (effectiveness < 1 ? ' No es muy efectivo...' : '');
    this.log = this.playerPkm.name + ' usa ' + attack.name + ' y hace ' + dmg + ' de daño.' + effectMsg;
    
    this.state = 'fight';
    this.attackChoice = 0;
    
    if(this.wild.hp <= 0){
      this.log += ' ' + this.wild.name + ' ha sido debilitado.';
      // Wait for animation to finish before ending battle
      setTimeout(()=>{ this._endBattle(); }, this.attackAnimation.duration);
      return;
    }
    
    // wild attacks back after animation completes
    setTimeout(()=>{
      // Start wild pokemon attack animation
      this.attackAnimation = {
        startTime: performance.now(),
        duration: 1000,
        attacker: 'wild'
      };
      
      // Wild pokemon selects random attack
      const wildAttacks = this._getAvailableAttacks(this.wild);
      const randomAttack = wildAttacks[Math.floor(Math.random() * wildAttacks.length)];
      const wildEffectiveness = this._getTypeEffectiveness(randomAttack.type, this.playerPkm.type);
      const wildVariability = Math.random() * 0.5 + 0.75;
      const dmg2 = Math.max(1, Math.floor((randomAttack.power || 40) * wildEffectiveness * wildVariability));
      
      this.playerPkm.hp = (this.playerPkm.hp || this.playerPkm.maxHp) - dmg2;
      const wildEffectMsg = wildEffectiveness > 1 ? ' ¡Es muy efectivo!' : (wildEffectiveness < 1 ? ' No es muy efectivo...' : '');
      this.log = this.wild.name + ' usa ' + randomAttack.name + ' y hace ' + dmg2 + ' de daño.' + wildEffectMsg;
      if(this.playerPkm.hp<=0){
        this.log += ' Tu pokémon se debilitó.';
        // Wait for animation to finish before ending battle
        setTimeout(()=>{ this._endBattle(); }, this.attackAnimation.duration);
      } else {
        // After wild's animation completes, clear animation and return to fight state
        setTimeout(()=>{ this.attackAnimation = null; }, this.attackAnimation.duration);
      }
    }, this.attackAnimation.duration);
  }

  _runAttempt(){
    if(Math.random() < 0.5){ this.log = 'Huiste del combate.'; this._endBattle(); }
    else { this.log = 'No pudiste huir.'; }
  }

  // Check if animation is in progress
  isAnimating(){
    if(!this.attackAnimation) return false;
    const elapsed = performance.now() - this.attackAnimation.startTime;
    return elapsed < this.attackAnimation.duration;
  }

  // Calculate attack animation progress (0 to 1)
  _getAnimationProgress(){
    if(!this.attackAnimation) return 0;
    const elapsed = performance.now() - this.attackAnimation.startTime;
    return Math.min(1, elapsed / this.attackAnimation.duration);
  }

  // Calculate sprite offset for arc jump animation
  _getJumpOffset(){
    const progress = this._getAnimationProgress();
    if(progress === 0 || !this.attackAnimation) return { x: 0, y: 0 };
    
    // Use sine wave for smooth arc: starts at 0, peaks at 0.5, returns to 0
    const arc = Math.sin(progress * Math.PI);
    
    // Forward movement: goes out then comes back (using parabola)
    const forwardDistance = 60; // pixels to move forward
    const forward = Math.sin(progress * Math.PI) * forwardDistance;
    
    // Arc height
    const arcHeight = -40; // negative = upward
    const vertical = arc * arcHeight;
    
    return { x: forward, y: vertical };
  }
  _endBattle(){
    setTimeout(()=>{ if(typeof this.onEnd==='function') this.onEnd(); }, 800);
  }
  render(ctx){
    const w = ctx.canvas.width, h = ctx.canvas.height;
    // background: top half blue, bottom half green
    ctx.fillStyle = '#5ea9ff'; ctx.fillRect(0,0,w,h/2);
    ctx.fillStyle = '#7fcf6f'; ctx.fillRect(0,h/2,w,h/2);

    ctx.save();
    ctx.font = '18px sans-serif'; ctx.fillStyle = '#000';
    // left: player active pokemon (draw image if available)
    const boxW = Math.min(260, w*0.45);
    const boxH = Math.min(240, h*0.5);
    const leftX = 40; const leftY = h/2 - boxH/2;
    
    // Get animation offset for player pokemon if attacking
    const playerOffset = (this.attackAnimation && this.attackAnimation.attacker === 'player') ? this._getJumpOffset() : { x: 0, y: 0 };
    
    // name above
    ctx.fillStyle = '#fff'; ctx.fillRect(leftX, leftY-34, boxW, 28);
    ctx.fillStyle = '#000'; ctx.fillText(this.playerPkm.name || 'TuPok', leftX+8, leftY-14);
    // hp bar between name and sprite
    const hpBarW = boxW - 40;
    const hpPct = (this.playerPkm.hp||0) / (this.playerPkm.maxHp||1);
    let hpColor = '#4caf50';
    if(hpPct <= 0.25) hpColor = '#d32f2f';
    else if(hpPct <= 0.5) hpColor = '#ff9800';
    ctx.fillStyle = '#222'; ctx.fillRect(leftX+20, leftY-6, hpBarW, 12);
    ctx.fillStyle = hpColor; ctx.fillRect(leftX+20, leftY-6, Math.max(0, hpBarW*hpPct), 12);
    // try draw friend image with animation offset
    const pname = String(this.playerPkm.name).toLowerCase();
    const pimg = (window.__ASSETS__ && window.__ASSETS__[pname+'-friend']) ? window.__ASSETS__[pname+'-friend'] : null;
    const playerImageX = leftX + playerOffset.x;
    const playerImageY = leftY + 12 + playerOffset.y;
    if(pimg){ ctx.drawImage(pimg, playerImageX, playerImageY, boxW, boxH-12); }
    else { ctx.fillStyle = '#ddddff'; ctx.fillRect(playerImageX, playerImageY, boxW, boxH-12); }

    // right: wild pokemon
    const rightW = boxW; const rightH = boxH;
    const rightX = w - rightW - 40; const rightY = leftY;
    
    // Get animation offset for wild pokemon if attacking
    const wildOffset = (this.attackAnimation && this.attackAnimation.attacker === 'wild') ? this._getJumpOffset() : { x: 0, y: 0 };
    
    ctx.fillStyle = '#fff'; ctx.fillRect(rightX, rightY-34, rightW, 28);
    ctx.fillStyle = '#000'; ctx.fillText(this.wild.name || 'Pokémon', rightX+8, rightY-14);
    const hpPct2 = (this.wild.hp||0) / (this.wild.maxHp||1);
    let hpColor2 = '#4caf50';
    if(hpPct2 <= 0.25) hpColor2 = '#d32f2f';
    else if(hpPct2 <= 0.5) hpColor2 = '#ff9800';
    ctx.fillStyle = '#222'; ctx.fillRect(rightX+20, rightY-6, hpBarW, 12);
    ctx.fillStyle = hpColor2; ctx.fillRect(rightX+20, rightY-6, Math.max(0, hpBarW*hpPct2), 12);
    const wname = String(this.wild.name).toLowerCase();
    const wimg = (window.__ASSETS__ && window.__ASSETS__[wname+'-enemy']) ? window.__ASSETS__[wname+'-enemy'] : null;
    // Wild pokemon moves in opposite direction (backward for attacks)
    const wildImageX = rightX - wildOffset.x;
    const wildImageY = rightY + 12 + wildOffset.y;
    if(wimg){ ctx.drawImage(wimg, wildImageX, wildImageY, rightW, rightH-12); }
    else { ctx.fillStyle = '#ffdddd'; ctx.fillRect(wildImageX, wildImageY, rightW, rightH-12); }

    // choices and menus are rendered in the canvas
    // show log area on canvas as well (small)
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(20, 20, Math.min(480, w-40), 28);
    ctx.fillStyle = '#000'; ctx.fillText(this.log, 28, 40);
    
    // Render the battle menu at the bottom
    if(this.state === 'fight'){
      this._renderBattleMenu(ctx, w, h);
    } else if(this.state === 'menu_attack'){
      this._renderAttackMenu(ctx, w, h);
    } else if(this.state === 'menu_switch'){
      this._renderSwitchMenu(ctx, w, h);
    } else if(this.state === 'menu_item'){
      this._renderItemMenu(ctx, w, h);
    }

    ctx.restore();
  }

  // Render the main battle menu (4 buttons in 2x2 grid)
  _renderBattleMenu(ctx, w, h){
    const opts = [
      { label: 'Fight', desc: 'Atacar' },
      { label: 'Run', desc: 'Huir' },
      { label: 'Switch', desc: 'Cambiar' },
      { label: 'Item', desc: 'Objeto' }
    ];
    
    const menuW = 220; // 2 buttons of 100px + gap
    const menuH = 140; // 2 rows of 60px + gap
    const menuX = w/2 - menuW/2;
    const menuY = h - menuH - 20;
    
    // Semi-transparent background
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(menuX - 10, menuY - 10, menuW + 20, menuH + 20);
    
    // Draw buttons
    const buttonW = 100;
    const buttonH = 60;
    const gap = 10;
    
    for(let i = 0; i < 4; i++){
      const row = Math.floor(i / 2);
      const col = i % 2;
      const btnX = menuX + col * (buttonW + gap);
      const btnY = menuY + row * (buttonH + gap);
      
      // Button background
      const isSelected = this.choice === i;
      const isAnimating = this.isAnimating();
      ctx.fillStyle = isAnimating ? '#333' : '#444';
      ctx.fillRect(btnX, btnY, buttonW, buttonH);
      
      // Selection border
      if(isSelected){
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.strokeRect(btnX, btnY, buttonW, buttonH);
      }
      
      // Button opacity if animating
      if(isAnimating){
        ctx.globalAlpha = 0.5;
      }
      
      // Text
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opts[i].label, btnX + buttonW/2, btnY + buttonH/2 - 8);
      
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#aaa';
      ctx.fillText(opts[i].desc, btnX + buttonW/2, btnY + buttonH/2 + 8);
      
      ctx.globalAlpha = 1;
    }
  }

  // Render the attack selection menu
  _renderAttackMenu(ctx, w, h){
    const attacks = this._getAvailableAttacks(this.playerPkm);
    const menuW = 300;
    const menuH = Math.min(400, attacks.length * 50 + 80);
    const menuX = w/2 - menuW/2;
    const menuY = h - menuH - 20;
    
    // Semi-transparent background
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(menuX - 10, menuY - 10, menuW + 20, menuH + 20);
    
    // Title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Select Attack (Esc to cancel)', menuX + 10, menuY + 10);
    
    // List items
    let yOffset = menuY + 40;
    for(let i = 0; i < attacks.length; i++){
      const attack = attacks[i];
      const isSelected = this.attackChoice === i;
      
      // Selection background
      if(isSelected){
        ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
        ctx.fillRect(menuX, yOffset - 5, menuW, 35);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.strokeRect(menuX, yOffset - 5, menuW, 35);
      }
      
      // Text
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(attack.name + ' [' + attack.type + ']', menuX + 15, yOffset);
      
      yOffset += 35;
    }
  }

  // Render the switch pokemon menu
  _renderSwitchMenu(ctx, w, h){
    const party = this.player.pokemon || [];
    const menuW = 300;
    const menuH = Math.min(400, party.length * 50 + 80);
    const menuX = w/2 - menuW/2;
    const menuY = h - menuH - 20;
    
    // Semi-transparent background
    ctx.fillStyle = 'rgba(0,0,0,0.8)';

    ctx.fillRect(menuX - 10, menuY - 10, menuW + 20, menuH + 20);
    
    // Title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Select Pokémon (Esc to cancel)', menuX + 10, menuY + 10);
    
    // List items
    let yOffset = menuY + 40;
    for(let i = 0; i < party.length; i++){
      const p = party[i];
      const isSelected = this.switchIndex === i;
      
      // Selection background
      if(isSelected){
        ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
        ctx.fillRect(menuX, yOffset - 5, menuW, 35);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.strokeRect(menuX, yOffset - 5, menuW, 35);
      }
      
      // Text
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name + ' (' + Math.max(0, p.hp) + '/' + p.maxHp + ')', menuX + 15, yOffset);
      
      yOffset += 35;
    }
  }

  // Render the item menu
  _renderItemMenu(ctx, w, h){
    const items = (this.player.items || []).filter(it => it.count > 0);
    const menuW = 300;
    const menuH = Math.min(400, items.length * 50 + 80);
    const menuX = w/2 - menuW/2;
    const menuY = h - menuH - 20;
    
    // Semi-transparent background
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(menuX - 10, menuY - 10, menuW + 20, menuH + 20);
    
    // Title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Use Item (Esc to cancel)', menuX + 10, menuY + 10);
    
    // List items
    let yOffset = menuY + 40;
    if(items.length === 0){
      ctx.fillStyle = '#aaa';
      ctx.font = '14px sans-serif';
      ctx.fillText('No items available', menuX + 15, yOffset);
    } else {
      for(let i = 0; i < items.length; i++){
        const item = items[i];
        const isSelected = this.itemIndex === i;
        
        // Selection background
        if(isSelected){
          ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
          ctx.fillRect(menuX, yOffset - 5, menuW, 35);
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 2;
          ctx.strokeRect(menuX, yOffset - 5, menuW, 35);
        }
        
        // Text
        ctx.fillStyle = '#fff';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(item.name + ' x' + item.count, menuX + 15, yOffset);
        
        yOffset += 35;
      }
    }
  }
}
