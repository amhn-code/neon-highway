window.addEventListener("load", () => {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const scoreVal = document.getElementById('score-val');
    const bestVal = document.getElementById('best-val');
    const speedVal = document.getElementById('speed-val');
    const fuelVal = document.getElementById('fuel-val');
    const finalScoreVal = document.getElementById('final-score-val');
    const pbScoreVal = document.getElementById('pb-score-val');
    const startScreen = document.getElementById('start-screen');
    const gameOverScreen = document.getElementById('game-over-screen');
    const failTitle = document.getElementById('fail-title');

    let WIDTH = window.innerWidth;
    let HEIGHT = window.innerHeight;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    const CAR_WIDTH = 40;
    const CAR_HEIGHT = 70;
    const HIT_WIDTH = 14; 
    const HIT_HEIGHT = 28;

    let gameActive = false;
    let distanceMiles = 0;
    
    // Smooth speedometer tracking variables
    let gameSpeed = 0; 
    let targetSpeed = 0;
    let currentMPH = 0;

    let keys = {};
    let roadCurve = 0;       
    let targetCurve = 0;     
    let curveTimer = 0;      
    let segmentOffset = 0;   

    let player = {
        x: WIDTH / 2 - CAR_WIDTH / 2,
        y: HEIGHT - CAR_HEIGHT - 150,
        speed: 8,
        color: "#00ffff" // Default color
    };

    let fuelPercent = 100;
    let nextStationMile = 5;
    let obstacles = [];
    let spawnTimer = 0;
    let stationActive = null;

    // Environment tracking variables
    let treeOffset = 0;
    let treePositions = [];

    // Handle Garage Color Selection
    const colorDots = document.querySelectorAll('.color-dot');
    colorDots.forEach(dot => {
        dot.addEventListener('click', (e) => {
            colorDots.forEach(d => d.classList.remove('selected'));
            e.target.classList.add('selected');
            player.color = e.target.getAttribute('data-color');
        });
    });

    let localHighScore = localStorage.getItem('neonHighwayHighScore') || 0;
    if(bestVal) bestVal.innerText = parseFloat(localHighScore).toFixed(2);

    // Initialize decorative scenery locations along road borders
    function initScenery() {
        treePositions = [];
        for (let i = 0; i < 15; i++) {
            treePositions.push({
                y: (i * (HEIGHT / 10)) - 100,
                side: Math.random() < 0.5 ? -1 : 1, // left side or right side
                type: Math.random() < 0.5 ? 'palm' : 'pine'
            });
        }
    }
    initScenery();

    window.addEventListener('resize', () => {
        WIDTH = window.innerWidth;
        HEIGHT = window.innerHeight;
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        initScenery();
    });

    window.addEventListener('keydown', (e) => { if (e.key) keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', (e) => { if (e.key) keys[e.key.toLowerCase()] = false; });

    function setupBtn(id, keyStr) {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('mousedown', () => { keys[keyStr] = true; });
        btn.addEventListener('mouseup', () => { keys[keyStr] = false; });
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); keys[keyStr] = true; });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); keys[keyStr] = false; });
    }
    setupBtn('btn-left', 'a');
    setupBtn('btn-right', 'd');
    setupBtn('btn-up', 'w');
    setupBtn('btn-down', 's');

    const startBtn = document.getElementById('start-btn');
    if(startBtn) {
        startBtn.addEventListener('click', () => {
            if(startScreen) startScreen.style.display = 'none';
            gameActive = true;
            targetSpeed = 6;
            gameSpeed = 6;
            gameLoop();
        });
    }

    const restartBtn = document.getElementById('restart-btn');
    if(restartBtn) {
        restartBtn.addEventListener('click', () => {
            resetGame();
        });
    }

    function getRoadCenterAt(y) {
        let perspectiveFactor = ((HEIGHT - y) / HEIGHT);
        let curveX = Math.sin(perspectiveFactor * Math.PI * 0.5) * roadCurve * 120;
        return (WIDTH / 2) + curveX;
    }

    function drawCar(x, y, color, isPlayer) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, CAR_WIDTH, CAR_HEIGHT);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x + 5, y + 15, CAR_WIDTH - 10, 12);
        ctx.fillStyle = isPlayer ? "#ff3333" : "#ffff00";
        let lightY = isPlayer ? y + CAR_HEIGHT - 6 : y;
        ctx.fillRect(x + 4, lightY, 8, 6);
        ctx.fillRect(x + CAR_WIDTH - 12, lightY, 8, 6);
    }

    function drawStation(x, y) {
        ctx.fillStyle = "#33ff33";
        ctx.fillRect(x, y, 50, 60);
        ctx.fillStyle = "#ffffff";
        ctx.font = "20px monospace";
        ctx.fillText("GAS", x + 25, y + 35);
    }

    // Draws custom environmental features that align to curved perspective lanes
    function drawScenery(yOffset, currentRoadWidth) {
        treePositions.forEach(tree => {
            // Forward movement physics updating
            tree.y += gameSpeed;
            if (tree.y > HEIGHT + 50) {
                tree.y = -100;
                tree.side = Math.random() < 0.5 ? -1 : 1;
            }

            let roadCenter = getRoadCenterAt(tree.y);
            let treeX = 0;
            
            if (tree.side === -1) {
                treeX = roadCenter - (currentRoadWidth / 2) - 50; // Left side grass
            } else {
                treeX = roadCenter + (currentRoadWidth / 2) + 20; // Right side grass
            }

            // Draw Foliage Base Trunk
            ctx.fillStyle = "#5c4033";
            ctx.fillRect(treeX + 12, tree.y + 30, 6, 20);

            // Draw Foliage Crown Leaves
            ctx.fillStyle = "#1e4d2b";
            ctx.beginPath();
            ctx.arc(treeX + 15, tree.y + 20, 20, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function gameLoop() {
        if (!gameActive) return;

        curveTimer++;
        if (curveTimer > 120) { 
            targetCurve = (Math.random() - 0.5) * 4; 
            curveTimer = 0;
        }
        roadCurve += (targetCurve - roadCurve) * 0.02;

        if (!keys['s']) distanceMiles += (gameSpeed * 0.0001);
        if(scoreVal) scoreVal.innerText = distanceMiles.toFixed(2);

        // REALISTIC SPEEDOMETER INTERPOLATION ENGINE
        if (keys['s']) {
            targetSpeed = 3; // Braking drops target speed
        } else if (keys['w']) {
            targetSpeed = distanceMiles > 0.5 ? 13 : 9; // Accelerating jumps target speed
        } else {
            targetSpeed = distanceMiles > 0.5 ? 10 : 6; // Standard base cruising target speeds
        }

        // Smoothly accelerate or decelerate toward target speed (simulates car weight momentum)
        gameSpeed += (targetSpeed - gameSpeed) * 0.05;

        // Convert base floating step value cleanly into realistic visual MPH dashboard readings
        let calculatedMPH = Math.floor(gameSpeed * 14.5);
        currentMPH += (calculatedMPH - currentMPH) * 0.1;
        if(speedVal) speedVal.innerText = Math.floor(currentMPH);

        if (!keys['s']) fuelPercent -= (gameSpeed * 0.001); 
        if (fuelPercent < 0) fuelPercent = 0;
        if(fuelVal) fuelVal.innerText = Math.ceil(fuelPercent);

        if (fuelPercent <= 0) { endGame("OUT OF FUEL!"); return; }

        if (keys['a']) player.x -= player.speed;
        if (keys['d']) player.x += player.speed;
        if (keys['w'] && player.y > HEIGHT * 0.2) player.y -= (player.speed - 2);
        if (keys['s'] && player.y < HEIGHT - CAR_HEIGHT - 140) player.y += player.speed;

        let playerRoadCenter = getRoadCenterAt(player.y);
        let roadWidthAtPlayer = Math.min(600, WIDTH * 0.6);
        let playerLeftBound = playerRoadCenter - roadWidthAtPlayer / 2 + 20;
        let playerRightBound = playerRoadCenter + roadWidthAtPlayer / 2 - CAR_WIDTH - 20;

        if (player.x < playerLeftBound) player.x = playerLeftBound;
        if (player.x > playerRightBound) player.x = playerRightBound;

        segmentOffset += gameSpeed;
        if (segmentOffset >= 60) segmentOffset = 0;

        ctx.clearRect(0, 0, WIDTH, HEIGHT);

        // Vibrant Green Grass Shoulder base fill across the map space
        ctx.fillStyle = '#0f3817';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        let currentRoadWidth = Math.min(600, WIDTH * 0.6);

        // Core road layout printing loop
        for (let y = 0; y < HEIGHT; y += 6) {
            let centerX = getRoadCenterAt(y);
            ctx.fillStyle = '#0d0d26';
            ctx.fillRect(centerX - currentRoadWidth / 2, y, currentRoadWidth, 6);
            ctx.fillStyle = '#ff007f';
            ctx.fillRect(centerX - currentRoadWidth / 2, y, 6, 6);
            ctx.fillStyle = '#00ffff';
            ctx.fillRect(centerX + currentRoadWidth / 2 - 6, y, 6, 6);
            if ((y + segmentOffset) % 60 < 30) {
                ctx.fillStyle = '#ffff00';
                ctx.fillRect(centerX - 3, y, 6, 6); 
            }
        }

        // Draw and process scenery alongside road structures
        drawScenery(segmentOffset, currentRoadWidth);

        if (distanceMiles >= nextStationMile - 0.1 && !stationActive) {
            stationActive = { y: -120, laneOffset: -(currentRoadWidth / 2) - 65 };
        }

        if (stationActive) {
            stationActive.y += gameSpeed;
            let stationX = getRoadCenterAt(stationActive.y) + stationActive.laneOffset;
            drawStation(stationX, stationActive.y);
            if (stationActive.y > player.y - 120 && stationActive.y < player.y + 120) {
                fuelPercent = 100; 
                nextStationMile += 5; 
            }
            if (stationActive.y > HEIGHT + 150) stationActive = null;
        }

// Render Player car using selected color from garage sectiondrawCar(player.x, player.y, player.color, true);spawnTimer += gameSpeed;if (spawnTimer > 220) { spawnObstacle(); spawnTimer = 0; }for (let i = obstacles.length - 1; i >= 0; i--) {let obs = obstacles[i];obs.y += gameSpeed + 1.5;obs.x = getRoadCenterAt(obs.y) + obs.laneOffset - CAR_WIDTH / 2;drawCar(obs.x, obs.y, "#ff3333", false);if (obs.y > HEIGHT + 100 || obs.y < -150) { obstacles.splice(i, 1); continue; }if (Math.abs((player.x + CAR_WIDTH/2) - (obs.x + CAR_WIDTH/2)) < HIT_WIDTH &&Math.abs((player.y + CAR_HEIGHT/2) - (obs.y + CAR_HEIGHT/2)) < HIT_HEIGHT) {endGame("CRASHED!");return;}}requestAnimationFrame(gameLoop);}function spawnObstacle() {if (!gameActive) return;let roadWidthAtTop = Math.min(600, WIDTH * 0.6);let maxOffset = (roadWidthAtTop / 2) - 40;let randomLaneOffset = (Math.random() * maxOffset * 2) - maxOffset;obstacles.push({ x: 0, y: -CAR_HEIGHT, laneOffset: randomLaneOffset });}function endGame(reason) {gameActive = false;if(failTitle) failTitle.innerText = reason;if(finalScoreVal) finalScoreVal.innerText = distanceMiles.toFixed(2);if (distanceMiles > localHighScore) {localHighScore = distanceMiles;localStorage.setItem('neonHighwayHighScore', distanceMiles);if(bestVal) bestVal.innerText = distanceMiles.toFixed(2);}if(pbScoreVal) pbScoreVal.innerText = parseFloat(localHighScore).toFixed(2);if(gameOverScreen) gameOverScreen.style.display = 'flex';}function resetGame() {obstacles = [];stationActive = null;WIDTH = window.innerWidth;HEIGHT = window.innerHeight;player.x = WIDTH / 2 - CAR_WIDTH / 2;player.y = HEIGHT - CAR_HEIGHT - 150;distanceMiles = 0;fuelPercent = 100;nextStationMile = 5;gameSpeed = 6;targetSpeed = 6;currentMPH = 0;roadCurve = 0;targetCurve = 0;curveTimer = 0;initScenery();if(gameOverScreen) gameOverScreen.style.display = 'none';gameActive = true;gameLoop();}});
