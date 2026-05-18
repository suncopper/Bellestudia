document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.createElement('canvas');
  canvas.id = 'bg-rain-canvas';
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  // zIndex en 0 para que quede detrás del contenido principal (#app tiene z-index: 1)
  canvas.style.zIndex = '0'; 
  canvas.style.opacity = '0.2'; // Muy sutil para que no moleste a la vista
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  
  let width, height;
  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  const kaomojis = [
    '❤', '(✿◠‿◠)', '⸜(｡˃ ᵕ ˂ )⸝♡', '★', '✧', 
    '(^-^*)', '♪', '૮ ˙Ⱉ˙ ა', '(´｡• ᵕ •｡`)', 
    '♡', '(≧◡≦)', '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧', '( ˘ ³˘)♥', 'ʕ•ᴥ•ʔ',
    '✿', '(✯◡✯)', '☆', '(◕‿◕)'
  ];

  const drops = [];
  // Un emoji por cada ~70px de ancho para que se vea esparcido y limpio
  const numDrops = Math.floor(window.innerWidth / 70); 

  for (let i = 0; i < numDrops; i++) {
    drops.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight * -1, // Empiezan arriba fuera de la pantalla
      speed: 0.3 + Math.random() * 0.8, // Caída muy lenta y relajante
      text: kaomojis[Math.floor(Math.random() * kaomojis.length)],
      fontSize: 14 + Math.random() * 14, // Tamaños variables
      opacity: 0.3 + Math.random() * 0.7
    });
  }

  function draw() {
    // Borramos el canvas entero en cada frame para no dejar rastro (no estilo matrix clásico)
    ctx.clearRect(0, 0, width, height);
    
    // Color principal acorde a la estética fucsia/rosada
    ctx.fillStyle = '#f0abfc'; 
    ctx.textAlign = 'center';

    drops.forEach(drop => {
      ctx.globalAlpha = drop.opacity;
      ctx.font = `bold ${drop.fontSize}px 'Outfit', sans-serif`;
      ctx.fillText(drop.text, drop.x, drop.y);

      drop.y += drop.speed;

      // Si sale de la pantalla por abajo, lo reseteamos arriba con nuevos valores
      if (drop.y > height + 50) {
        drop.y = -50 - Math.random() * 100;
        drop.x = Math.random() * width;
        drop.speed = 0.3 + Math.random() * 0.8;
        drop.text = kaomojis[Math.floor(Math.random() * kaomojis.length)];
      }
    });

    requestAnimationFrame(draw);
  }

  // Empezar animación
  draw();
});
