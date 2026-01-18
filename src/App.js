import React, { useState, useEffect, useRef } from 'react';

const HillClimbGame = () => {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [fuel, setFuel] = useState(100);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  
  const gameStateRef = useRef({
    car: {
      x: 100,
      y: 300,
      vx: 0,
      vy: 0,
      angle: 0,
      angularVelocity: 0,
      width: 60,
      height: 30,
      wheelRadius: 12
    },
    terrain: [],
    keys: {},
    distance: 0,
    coins: [],
    fuelCans: []
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const game = gameStateRef.current;
    
    // Generate initial terrain
    game.terrain = generateTerrain(0, 200);
    
    // Generate coins and fuel
    generateCollectibles();
    
    const handleKeyDown = (e) => {
      if (e.key === ' ' && gameOver) {
        resetGame();
        return;
      }
      if (!started && (e.key === 'ArrowUp' || e.key === 'ArrowRight')) {
        setStarted(true);
      }
      game.keys[e.key] = true;
    };
    
    const handleKeyUp = (e) => {
      game.keys[e.key] = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    let animationId;
    let lastTime = Date.now();
    
    const gameLoop = () => {
      const now = Date.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      
      if (!gameOver && started) {
        update(dt);
        checkCollisions();
      }
      
      render(ctx);
      animationId = requestAnimationFrame(gameLoop);
    };
    
    gameLoop();
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationId);
    };
  }, [gameOver, started]);
  
  const generateTerrain = (startX, count) => {
    const terrain = [];
    let x = startX;
    let y = 400;
    
    for (let i = 0; i < count; i++) {
      terrain.push({ x, y });
      x += 30 + Math.random() * 20;
      y += (Math.random() - 0.5) * 80;
      y = Math.max(200, Math.min(500, y));
    }
    
    return terrain;
  };
  
  const generateCollectibles = () => {
    const game = gameStateRef.current;
    game.coins = [];
    game.fuelCans = [];
    
    for (let i = 0; i < 50; i++) {
      const x = 500 + i * 200 + Math.random() * 100;
      const y = getTerrainHeight(x) - 50 - Math.random() * 100;
      game.coins.push({ x, y, collected: false, radius: 10 });
    }
    
    for (let i = 0; i < 20; i++) {
      const x = 800 + i * 300 + Math.random() * 200;
      const y = getTerrainHeight(x) - 40;
      game.fuelCans.push({ x, y, collected: false, width: 20, height: 30 });
    }
  };
  
  const getTerrainHeight = (x) => {
    const game = gameStateRef.current;
    const terrain = game.terrain;
    
    for (let i = 0; i < terrain.length - 1; i++) {
      if (x >= terrain[i].x && x <= terrain[i + 1].x) {
        const t = (x - terrain[i].x) / (terrain[i + 1].x - terrain[i].x);
        return terrain[i].y + t * (terrain[i + 1].y - terrain[i].y);
      }
    }
    
    return terrain[terrain.length - 1].y;
  };
  
  const getTerrainAngle = (x) => {
    const game = gameStateRef.current;
    const terrain = game.terrain;
    
    for (let i = 0; i < terrain.length - 1; i++) {
      if (x >= terrain[i].x && x <= terrain[i + 1].x) {
        const dx = terrain[i + 1].x - terrain[i].x;
        const dy = terrain[i + 1].y - terrain[i].y;
        return Math.atan2(dy, dx);
      }
    }
    
    return 0;
  };
  
  const update = (dt) => {
    const game = gameStateRef.current;
    const car = game.car;
    
    // Apply gravity
    car.vy += 980 * dt;
    
    // Gas pedal
    if (game.keys['ArrowUp'] || game.keys['ArrowRight']) {
      if (fuel > 0) {
        const force = 1200;
        car.vx += Math.cos(car.angle) * force * dt;
        car.vy += Math.sin(car.angle) * force * dt;
        setFuel(f => Math.max(0, f - 8 * dt));
      }
    }
    
    // Brake
    if (game.keys['ArrowDown'] || game.keys['ArrowLeft']) {
      car.vx *= 0.95;
    }
    
    // Update position
    car.x += car.vx * dt;
    car.y += car.vy * dt;
    car.angle += car.angularVelocity * dt;
    
    // Terrain collision
    const frontWheelX = car.x + Math.cos(car.angle) * 25;
    const frontWheelY = car.y + Math.sin(car.angle) * 25;
    const rearWheelX = car.x - Math.cos(car.angle) * 25;
    const rearWheelY = car.y - Math.sin(car.angle) * 25;
    
    const frontGroundY = getTerrainHeight(frontWheelX);
    const rearGroundY = getTerrainHeight(rearWheelX);
    
    // Simple ground collision
    if (frontWheelY > frontGroundY - car.wheelRadius) {
      const penetration = frontWheelY - (frontGroundY - car.wheelRadius);
      car.y -= penetration * 0.5;
      car.vy *= -0.3;
      
      const terrainAngle = getTerrainAngle(frontWheelX);
      car.angle = car.angle * 0.9 + terrainAngle * 0.1;
    }
    
    if (rearWheelY > rearGroundY - car.wheelRadius) {
      const penetration = rearWheelY - (rearGroundY - car.wheelRadius);
      car.y -= penetration * 0.5;
      car.vy *= -0.3;
      
      const terrainAngle = getTerrainAngle(rearWheelX);
      car.angle = car.angle * 0.9 + terrainAngle * 0.1;
    }
    
    // Check if car flipped or fell
    if (car.y > 600 || Math.abs(car.angle) > Math.PI * 0.6) {
      setGameOver(true);
    }
    
    // Extend terrain
    if (car.x > game.terrain[game.terrain.length - 50].x) {
      const newTerrain = generateTerrain(
        game.terrain[game.terrain.length - 1].x,
        50
      );
      game.terrain.push(...newTerrain);
    }
    
    // Update score
    game.distance = Math.max(game.distance, car.x);
    setScore(Math.floor(game.distance / 10));
    
    // Out of fuel
    if (fuel <= 0 && car.vx < 10) {
      setGameOver(true);
    }
  };
  
  const checkCollisions = () => {
    const game = gameStateRef.current;
    const car = game.car;
    
    // Coins
    game.coins.forEach(coin => {
      if (!coin.collected) {
        const dx = car.x - coin.x;
        const dy = car.y - coin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 30) {
          coin.collected = true;
          setScore(s => s + 10);
        }
      }
    });
    
    // Fuel cans
    game.fuelCans.forEach(can => {
      if (!can.collected) {
        const dx = car.x - can.x;
        const dy = car.y - can.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 35) {
          can.collected = true;
          setFuel(f => Math.min(100, f + 30));
        }
      }
    });
  };
  
  const resetGame = () => {
    const game = gameStateRef.current;
    game.car = {
      x: 100,
      y: 300,
      vx: 0,
      vy: 0,
      angle: 0,
      angularVelocity: 0,
      width: 60,
      height: 30,
      wheelRadius: 12
    };
    game.terrain = generateTerrain(0, 200);
    game.distance = 0;
    generateCollectibles();
    setScore(0);
    setFuel(100);
    setGameOver(false);
    setStarted(false);
  };
  
  const render = (ctx) => {
    const game = gameStateRef.current;
    const car = game.car;
    
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, 800, 600);
    
    // Camera follows car
    ctx.save();
    ctx.translate(-car.x + 200, 0);
    
    // Draw terrain
    ctx.fillStyle = '#8B7355';
    ctx.beginPath();
    ctx.moveTo(game.terrain[0].x, game.terrain[0].y);
    
    for (let i = 1; i < game.terrain.length; i++) {
      ctx.lineTo(game.terrain[i].x, game.terrain[i].y);
    }
    
    ctx.lineTo(game.terrain[game.terrain.length - 1].x, 600);
    ctx.lineTo(game.terrain[0].x, 600);
    ctx.closePath();
    ctx.fill();
    
    // Draw grass
    ctx.strokeStyle = '#228B22';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(game.terrain[0].x, game.terrain[0].y);
    for (let i = 1; i < game.terrain.length; i++) {
      ctx.lineTo(game.terrain[i].x, game.terrain[i].y);
    }
    ctx.stroke();
    
    // Draw coins
    game.coins.forEach(coin => {
      if (!coin.collected) {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFA500';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
    
    // Draw fuel cans
    game.fuelCans.forEach(can => {
      if (!can.collected) {
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(can.x - can.width/2, can.y - can.height, can.width, can.height);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Arial';
        ctx.fillText('F', can.x - 4, can.y - can.height/2 + 4);
      }
    });
    
    // Draw car
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    
    // Car body
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(-30, -15, 60, 25);
    
    // Car roof
    ctx.fillStyle = '#CC0000';
    ctx.fillRect(-15, -30, 30, 15);
    
    // Wheels
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(-25, 15, car.wheelRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(25, 15, car.wheelRadius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    ctx.restore();
    
    // UI
    ctx.fillStyle = '#000000';
    ctx.font = '24px Arial';
    ctx.fillText(`Distance: ${score}m`, 10, 30);
    
    // Fuel bar
    ctx.fillStyle = '#333333';
    ctx.fillRect(10, 50, 200, 20);
    ctx.fillStyle = fuel > 30 ? '#00FF00' : '#FF0000';
    ctx.fillRect(10, 50, fuel * 2, 20);
    ctx.strokeStyle = '#000000';
    ctx.strokeRect(10, 50, 200, 20);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '14px Arial';
    ctx.fillText('FUEL', 85, 65);
    
    if (!started) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, 800, 600);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '36px Arial';
      ctx.fillText('HILL CLIMB RACING', 200, 250);
      ctx.font = '20px Arial';
      ctx.fillText('Press ↑ or → to start', 270, 300);
      ctx.fillText('↑/→ = Gas    ↓/← = Brake', 240, 350);
    }
    
    if (gameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, 800, 600);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '48px Arial';
      ctx.fillText('GAME OVER', 250, 250);
      ctx.font = '24px Arial';
      ctx.fillText(`Final Distance: ${score}m`, 260, 300);
      ctx.fillText('Press SPACE to restart', 240, 350);
    }
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="border-4 border-gray-700 rounded-lg"
      />
    </div>
  );
};

export default HillClimbGame;
