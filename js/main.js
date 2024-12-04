$(document).ready(function () {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  let gameRunning = true;

  let player = {
    x: 120,
    y: 100,
    health: 100,
    hasKey: false,
    speed: 0,       // Current speed
    maxSpeed: 2,    // Maximum speed
    acceleration: 0.1, // Acceleration rate
    friction: 0.05,    // Deceleration rate
    dx: 0,          // Horizontal velocity
    dy: 0           // Vertical velocity
  };

  let particles = [];

  // Game state
  let currentLevel = 1;
  let maxLevels = 99;
  let score = 0;
  let timeCounter = 0;
  let candleTimer = 100;

  // Display high score
  const highScore = localStorage.getItem('highScore') || '000000';
  document.getElementById('high-score').textContent = highScore.toString().padStart(6, '0');

  // Level elements
  let ghosts = [];
  let candles = [];
  let keys = [];
  let doors = [];
  let healthPacks = [];

  // Cooldown variables for repel
  let canRepel = true;
  const repelCooldown = 500; // Cooldown time in milliseconds

  // Sounds
  const bgSound = new Audio('audio/bg2.ogg');
  const ghostSound = new Audio('audio/hurt1.ogg');
  const candleSound = new Audio('audio/pickup1.ogg');
  const hurtSound = new Audio('audio/static1.ogg');
  const healthSound = new Audio('audio/powerup4.ogg');
  const keySound = new Audio('audio/powerup3.ogg');
  const doorUnlockSound = new Audio('audio/upgrade2.ogg');

  bgSound.loop = true;
  bgSound.volume = 0.3;

  // Handle Start Screen
  const startScreen = document.getElementById('start-screen');
  const startButton = document.getElementById('start-button');

  const playingKeys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    w: false,
    a: false,
    s: false,
    d: false
  };

  // windows keys init
  window.addEventListener('keydown', (e) => {
    if (e.key in playingKeys) {
      playingKeys[e.key] = true;
      e.preventDefault(); // Prevent default browser behavior (like scrolling)
      }

      // Trigger repel action on specific key (e.g., spacebar)
      if (e.key === ' ') { // Spacebar
        repelGhosts();
        e.preventDefault(); // Prevent default scrolling
      }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key in playingKeys) {
      playingKeys[e.key] = false;
      e.preventDefault();
    }
  });

  // Gamepad state
  let gamepad = null;

  // Detect and update gamepad input
  function updateGamepad() {
    const gamepads = navigator.getGamepads();
    gamepad = gamepads[0]; // Use the first connected gamepad

    if (gamepad) {
      const threshold = 0.5; // Dead zone for analog stick
      if (gamepad.axes[0] < -threshold) player.x -= player.speed; // Left
      if (gamepad.axes[0] > threshold) player.x += player.speed; // Right
      if (gamepad.axes[1] < -threshold) player.y -= player.speed; // Up
      if (gamepad.axes[1] > threshold) player.y += player.speed; // Down

      // Trigger repel action on Button A press
      if (gamepad.buttons[0].pressed && canRepel) {
        repelGhosts();
      }
    }
  }

  // Repel ghosts using candles
  function repelGhosts() {
    if (canRepel && candleTimer > 0) { // Ensure there's enough light to repel
      candleTimer = Math.max(0, candleTimer - 10); // Deduct 10 units, ensure it doesn't go below 0
      canRepel = false; // Disable further repelling until cooldown ends

      // Repel only the closest ghost
      let closestGhost = null;
      let minDistance = Infinity;

      ghosts.forEach(ghost => {
        const distance = Math.sqrt(
          Math.pow(ghost.x - player.x, 2) + Math.pow(ghost.y - player.y, 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestGhost = ghost;
        }
      });

      if (closestGhost) {
        closestGhost.x += closestGhost.x > player.x ? 16 : -16; // Push ghost away
        closestGhost.y += closestGhost.y > player.y ? 16 : -16;
        closestGhost.repelEffect = 10; // Set timer for visual effect
        //ghosts = ghosts.filter(ghost => ghost !== closestGhost); // Remove ghost
        ghostSound.play();
        score += 50; // Add 50 points for removing a ghost
        updateScoreDisplay();
      }

      // Start cooldown timer
      setTimeout(() => {
        canRepel = true;
      }, repelCooldown);
    }
  }

  // Update scpre display
  function updateScoreDisplay() {
    const scoreStr = score.toString().padStart(6, '0');
    document.getElementById('score-value').textContent = scoreStr;
  }

  // Random level generator
  function generateRandomLevel() {
    ghosts = [];
    candles = [];
    keys = [];
    doors = [];
    healthPacks = []; // Clear previous level's health packs

    // Place ghosts randomly
    for (let i = 0; i < currentLevel + 2; i++) {
      ghosts.push({
        x: Math.random() * (canvas.width - 8),
        y: Math.random() * (canvas.height - 8),
        dx: Math.random() < 0.5 ? 1 : -1,
        dy: Math.random() < 0.5 ? 1 : -1,
        repelEffect: 0 // Timer for visual effect
      });
    }

    // Place candles randomly
    for (let i = 0; i < currentLevel; i++) {
      candles.push({
        x: Math.random() * (canvas.width - 8),
        y: Math.random() * (canvas.height - 8),
      });
    }

    // Place a key randomly
    keys.push({
      x: Math.random() * (canvas.width - 8),
      y: Math.random() * (canvas.height - 8),
    });

    // Place a door at a fixed position for simplicity
    doors.push({
      x: canvas.width - 8,
      y: Math.random() * (canvas.height - 16),
      locked: true,
    });

    // Spawn health packs on random levels
    if (Math.random() > 0.5) { // 50% chance to spawn health packs
      const numberOfHealthPacks = Math.floor(Math.random() * 3) + 1; // 1 to 3 packs
      for (let i = 0; i < numberOfHealthPacks; i++) {
        healthPacks.push({
          x: Math.random() * (canvas.width - 8),
          y: Math.random() * (canvas.height - 8),
        });
      }
    }

    // Reset player state
    player.hasKey = false;

    // Update UI for the new level
    document.getElementById('level').textContent = currentLevel;
  }

  // Update ghosts (AI movement)
  function updateGhosts() {
    ghosts.forEach(ghost => {
      ghost.x += ghost.dx;
      ghost.y += ghost.dy;

      if (ghost.x < 0 || ghost.x > canvas.width - 8) ghost.dx *= -1;
      if (ghost.y < 0 || ghost.y > canvas.height - 8) ghost.dy *= -1;

      if (Math.abs(ghost.x - player.x) < 8 && Math.abs(ghost.y - player.y) < 8) {
        player.health -= 1;
        //hurtSound.play();

        hurtSound.play(); // Start playing the sound

        setTimeout(() => {
          hurtSound.pause(); // Pause the sound
          hurtSound.currentTime = 0; // Reset the playback position to the start
        }, 700);

        if (!isStunned) {
          applyStun();
        }
      }
    });
  }

  function createParticle() {
    let offsetX = 0;
    let offsetY = 0;

    // Determine particle spawn position based on movement direction
    if (Math.abs(player.dx) > Math.abs(player.dy)) {
      // Moving horizontally
      offsetX = player.dx > 0 ? -6 : 16; // Align with the right or left edge
      offsetY = 2; // Centered vertically
    } else {
      // Moving vertically
      offsetY = player.dy > 0 ? -6 : 16; // Align with the bottom or top edge
      offsetX = 2; // Centered horizontally
    }

    // Create particle
    particles.push({
      x: player.x + offsetX,
      y: player.y + offsetY,
      dx: (Math.random() - 0.5) * 0.5, // Small random horizontal velocity
      dy: (Math.random() - 0.5) * 0.5, // Small random vertical velocity
      size: Math.random() * 10 + 4, // Random size
      life: 4 // Lifetime in frames
    });
  }

  function updateParticles() {
    particles = particles.filter(particle => particle.life > 0); // Remove dead particles
    particles.forEach(particle => {
      particle.x += particle.dx; // Move particle
      particle.y += particle.dy;
      particle.life--; // Reduce life
    });
  }

  function drawParticles() {
    particles.forEach(particle => {
      ctx.fillStyle = `rgba(255, 255, 255, ${particle.life / 40})`; // Fading effect
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    });
  }

  /////////////////////////////////////////////////////////////////////
  // STUN PART
  let isStunned = false; // Track if the player is stunned
  let stunDuration = 1000; // Duration of stun in milliseconds
  let stunStartTime = null; // Time when stun starts

  let shakeDuration = 300; // Duration of shake in milliseconds
  let shakeStartTime = null; // Time when shake starts
  let isShaking = false;

  // Player is hit, apply stun
  function applyStun() {
    isStunned = true;
    stunStartTime = Date.now(); // Record when stun starts

    // Play hurt sound
    //hurtAudio.play();

    // Optional: Trigger shake or flash effect
    triggerShake();
  }

  // Check if stun duration is over
  function updateStunState() {
    if (isStunned && Date.now() - stunStartTime >= stunDuration) {
      isStunned = false; // End stun after duration
    }
  }

  // Trigger shake
  function triggerShake() {
    isShaking = true;
    shakeStartTime = Date.now();
  }

  // Apply shake effect
  function applyShakeEffect() {
    if (isShaking) {
      if (Date.now() - shakeStartTime >= shakeDuration) {
        isShaking = false; // End shake after duration
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset canvas transform
        return;
      }

      // Apply random translation to canvas
      const offsetX = Math.random() * 4 - 2; // Random offset between -2 and 2
      const offsetY = Math.random() * 4 - 2;
      ctx.setTransform(1, 0, 0, 1, offsetX, offsetY);
    }
  }
  /////////////////////////////////////////////////////////////////////////////////

  function updatePlayerMovement() {
    if (isStunned) return; // Skip movement if stunned

    // Gamepad input
    if (gamepad) {
      const threshold = 0.5;
      if (gamepad.axes[0] < -threshold) player.dx = Math.max(player.dx - player.acceleration, -player.maxSpeed);
      if (gamepad.axes[0] > threshold) player.dx = Math.min(player.dx + player.acceleration, player.maxSpeed);
      if (gamepad.axes[1] < -threshold) player.dy = Math.max(player.dy - player.acceleration, -player.maxSpeed);
      if (gamepad.axes[1] > threshold) player.dy = Math.min(player.dy + player.acceleration, player.maxSpeed);
    }

    // Keyboard input
    if (playingKeys.ArrowUp || playingKeys.w) player.dy = Math.max(player.dy - player.acceleration, -player.maxSpeed);
    if (playingKeys.ArrowDown || playingKeys.s) player.dy = Math.min(player.dy + player.acceleration, player.maxSpeed);
    if (playingKeys.ArrowLeft || playingKeys.a) player.dx = Math.max(player.dx - player.acceleration, -player.maxSpeed);
    if (playingKeys.ArrowRight || playingKeys.d) player.dx = Math.min(player.dx + player.acceleration, player.maxSpeed);

    // Apply friction
    player.dx *= 1 - player.friction;
    player.dy *= 1 - player.friction;

    // Update position
    player.x += player.dx;
    player.y += player.dy;

    // Restrict movement within canvas boundaries
    if (player.x < 0) player.x = 0;
    if (player.x > canvas.width - 16) player.x = canvas.width - 16;
    if (player.y < 0) player.y = 0;
    if (player.y > canvas.height - 16) player.y = canvas.height - 16;

    // Create dust particles when moving
    if (Math.abs(player.dx) > 0.1 || Math.abs(player.dy) > 0.1) {
      createParticle();
    }
  }

  // Lighting effect
  function drawLighting() {
    // Draw a dark overlay for the entire canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'; // Semi-transparent darkness
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Define a circular light gradient centered on the player
    //const lightRadius = 100 + Math.random() * 10;

    //const lightRadius = Math.max(20, candleTimer * 2);
    //const lightRadius = Math.max(50, Math.min(candleTimer * 2, 150));
    //const lightRadius = 100;

    // Base radius calculation
    let baseRadius = candleTimer * 2;
    const clampedRadius = Math.max(50, Math.min(baseRadius, 150)); // Clamp between 50 and 150

    // Add independent flicker effect
    const flicker = Math.random() * 10 - 5; // Random flicker between -5 and +5
    const lightRadius = clampedRadius + flicker; // Add flicker after clamping

    const gradient = ctx.createRadialGradient(
      player.x + 4, player.y + 4, 0, // Light center (player position)
      player.x + 4, player.y + 4, lightRadius // Radius of the light
    );

    // Add gradient stops for a smooth light effect
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)'); // Bright center
    gradient.addColorStop(1, 'rgba(255, 255, 255, 1)'); // Fades to transparent

    // Use the gradient to "cut out" light from the darkness
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Reset the composite operation for subsequent drawings
    ctx.globalCompositeOperation = 'source-over';
  }

  // Check for item collection
  function checkItemCollection() {
    // candles = candles.filter(candle => {
    //   if (Math.abs(candle.x - player.x) < 16 && Math.abs(candle.y - player.y) < 16) {
    //     player.candles++;
    //     candleSound.play();
    //     return false; // Remove candle
    //   }
    //   return true;
    // });

    candles = candles.filter(candle => {
      if (Math.abs(candle.x - player.x) < 16 && Math.abs(candle.y - player.y) < 16) {
        candleTimer = Math.min(candleTimer + 50, 200); // Increase timer, max of 200
        candleSound.play();
        return false; // Remove the candle
      }
      return true;
    });

    keys = keys.filter(key => {
      if (Math.abs(key.x - player.x) < 16 && Math.abs(key.y - player.y) < 16) {
        player.hasKey = true;
        keySound.play();
        return false; // Remove key
      }
      return true;
    });

    healthPacks = healthPacks.filter(healthPack => {
      if (Math.abs(healthPack.x - player.x) < 16 && Math.abs(healthPack.y - player.y) < 16) {
        player.health = Math.min(player.health + 20, 100); // Restore health, max 100
        healthSound.play();
        return false; // Remove health pack
      }
      return true;
    });
  }

  // Check for door unlocking
  function checkDoorInteraction() {
    doors.forEach(door => {
      if (door.locked && Math.abs(door.x - player.x) < 16 && Math.abs(door.y - player.y) < 16) {
        if (player.hasKey) {
          door.locked = false;
          advanceToNextLevel();
        }
      }
    });
  }

  // Advance to the next level
  function advanceToNextLevel() {
    if (currentLevel < maxLevels) {
      doorUnlockSound.play();
      currentLevel++;
      score += 100; // Add 100 points for completing a level
      updateScoreDisplay();
      generateRandomLevel();
      //alert(`Level ${currentLevel} begins!`);
    } else {
      gameRunning = false;
      alert("Congratulations! You've escaped the haunted mansion!");
    }
  }

  // Drawing function
  function draw() {
    ctx.fillStyle = 'teal';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'white';
    ctx.fillRect(player.x, player.y, 16, 16);

    // Draw the border with rgba
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'; // Semi-transparent black
    ctx.lineWidth = 4;
    ctx.strokeRect(player.x, player.y, 16, 16);

    // Draw the smiley face
    const centerX = player.x + 8; // Center of the ghost
    const centerY = player.y + 8;

    // Draw eyes
    ctx.fillStyle = 'black'; // Eye color
    ctx.beginPath();
    ctx.arc(centerX - 4, centerY - 2, 0.8, 0, Math.PI * 2); // Left eye
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centerX + 4, centerY - 2, 0.8, 0, Math.PI * 2); // Right eye
    ctx.fill();

    // Draw mouth (straight line)
    ctx.strokeStyle = 'black'; // Mouth color
    ctx.lineWidth = 0.5; // Thin line
    ctx.beginPath();
    ctx.moveTo(centerX - 3, centerY + 3); // Start of the mouth
    ctx.lineTo(centerX + 3, centerY + 3); // End of the mouth
    ctx.stroke();

    ghosts.forEach(ghost => {
      // Fill the ghost square
      ctx.fillStyle = ghost.repelEffect > 0 ? 'white' : 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(ghost.x, ghost.y, 8, 8);

      // Draw the border with rgba
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; // Semi-transparent black
      ctx.lineWidth = 1;
      ctx.strokeRect(ghost.x, ghost.y, 8, 8);

      if (ghost.repelEffect > 0) ghost.repelEffect--;
    });

    candles.forEach(candle => {
      // Fill the candle square
      ctx.fillStyle = 'rgba(255, 215, 0, 0.6)';
      ctx.fillRect(candle.x, candle.y, 8, 8);

      // Draw the border with rgba
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'; // Slightly less transparent black
      ctx.lineWidth = 1;
      ctx.strokeRect(candle.x, candle.y, 8, 8);
    });

    keys.forEach(key => {
      // Fill the key square
      ctx.fillStyle = 'rgba(127, 17, 224, 0.6)';
      ctx.fillRect(key.x, key.y, 8, 8);

      // Draw the border with rgba
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'; // Semi-transparent white
      ctx.lineWidth = 1;
      ctx.strokeRect(key.x, key.y, 8, 8);
    });

    doors.forEach(door => {
      // Fill the door rectangle
      ctx.fillStyle = door.locked ? 'rgba(150, 75, 0, 0.8)' : 'gray';
      ctx.fillRect(door.x, door.y, 8, 16);

      // Draw the border with rgba
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'; // Semi-transparent blue
      ctx.lineWidth = 1;
      ctx.strokeRect(door.x, door.y, 8, 16);
    });

    healthPacks.forEach(healthPack => {
      // Fill the health pack square
      ctx.fillStyle = 'rgba(50, 205, 50, 0.9)';
      ctx.fillRect(healthPack.x, healthPack.y, 8, 8);

      // Draw the border with rgba
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'; // Semi-transparent green
      ctx.lineWidth = 1;
      ctx.strokeRect(healthPack.x, healthPack.y, 8, 8);
    });

    drawLighting();
    drawParticles();

    document.getElementById('health').textContent = player.health;
    document.getElementById('items').textContent = `Key: ${player.hasKey ? 'Yes' : 'No'}`;
    //document.getElementById('items').textContent = `Candles: ${player.candles} Key: ${player.hasKey ? 'Yes' : 'No'}`;

    if (player.health <= 0) {
      gameRunning = false;

      // Save the high score if applicable
      if (score > highScore) {
        localStorage.setItem('highScore', score);
      }

      //alert(`Game Over! Your Score: ${score}`);
      alert(`Game Over! Your Score: ${score.toString().padStart(6, '0')}`);
      location.reload();
    }
  }

  // Game loop
  function gameLoop() {
    if (!gameRunning) return;

    // Update game state
    updateStunState();

    // Apply shake effect
    applyShakeEffect();

    // Update gamepad inputs (if available)
    updateGamepad();

    // Update player movement and particles
    updatePlayerMovement(); // Smooth movement
    updateParticles(); // Update particle effects

    // Update game elements
    updateGhosts(); // Update ghost positions
    checkItemCollection(); // Handle items like candles, keys, health packs
    checkDoorInteraction(); // Check for door unlocking and level progression

    // Render the game
    draw();

    // Increment score every second
    timeCounter++;
    if (timeCounter % 60 === 0) { // Assuming 60 FPS
      score += 10; // Add 10 points for surviving 1 second
      //document.getElementById('score-value').textContent = score;
      updateScoreDisplay();
    }

    // Decrease the candle timer
    candleTimer -= 0.1; // Decrease by 0.1 per frame (adjust for your game's speed)
    if (candleTimer <= 0) {
        candleTimer = 0; // Prevent negative values
    }

    document.getElementById('timer-value').textContent = Math.ceil(candleTimer);

    // Request the next frame
    requestAnimationFrame(gameLoop);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////
  // game pad start button part
  let gameStarted = false; // Track if the game has started

  function checkGamepadStart() {
    const gamepads = navigator.getGamepads(); // Get all connected gamepads
    const gamepad = gamepads[0]; // Use the first connected gamepad

    if (gamepad && gamepad.buttons[9].pressed) { // Button index 9 is usually the Start button
      if (!gameStarted) { // Prevent multiple presses
        startGame();
      }
    }

    if (!gameStarted) {
      requestAnimationFrame(checkGamepadStart); // Keep checking until the game starts
    }
  }

  function startGame() {
    gameStarted = true;
    $('#start-screen').fadeOut(500, function() {
      $('#game-container').fadeIn(500); // Show game
      bgSound.play();
      generateRandomLevel(); // Initialize the first level
      gameLoop(); // Start the game loop
    });
  }

  // Call this on page load to start listening for the Start button on gamepad
  checkGamepadStart();
  ///////////////////////////////////////////////////////////////////////////////////////////////////

  // Hide game from beginning
  $('#game-container').hide();

  // När "Starta spel"-knappen klickas
  $('#start-button').click(function() {
    // Göm startskärmen och visa spelet
    $('#start-screen').fadeOut(500, function() {
      $('#game-container').fadeIn(500); // Show game
      bgSound.play();
      generateRandomLevel(); // Initialize the first level
      gameLoop(); // Start the game loop
    });
  });

  // generateRandomLevel();
  // gameLoop();
});
