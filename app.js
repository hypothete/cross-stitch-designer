const can = document.querySelector('canvas');
const ctx = can.getContext('2d');

const colorPicker = document.querySelector('#current-color');
const ariaPicker = document.querySelector('#aria-color');
const canWidth = document.querySelector('#can-width');
const canHeight = document.querySelector('#can-height');
const swScale = document.querySelector('#sw-scale');
const useBs = document.querySelector('#backstitch-mode');
const useErase = document.querySelector('#erase-mode');
const palette = document.querySelector('#palette');
const bgImage = document.querySelector('#bg-image');
const bgDisplay = document.querySelector('#bg-display');
const bgShow = document.querySelector('#show-bg');
const loadBtn = document.querySelector('#load');
const saveBtn = document.querySelector('#save');
const nameInput = document.querySelector('#design-name');

let sw = Number(swScale.value); // stitch width
let cw = Number(canWidth.value);
let ch = Number(canHeight.value);
let stitches = [];
let backstitches = [];
let ariaColor = '#ccc0c0';
let currentColor = colorPicker.value;
let currentShape = 0;
let bsMode = false;
let eraseMode = false;
let mouseDown = false;
let currentBackstitch = null;
let designName = '';

// Scale on load for small devices
if (cw * sw > window.innerWidth) {
  swScale.value = sw = Math.round(( 0.9 * window.innerWidth ) / cw);
}

can.width = cw * sw;
can.height = ch * sw;

can.addEventListener('mousedown', e => {
  mouseStart(e);
});

can.addEventListener('touchstart', e => {
  e.preventDefault();
  mouseStart(e.touches[0]);
});

can.addEventListener('mouseup', e => {
  mouseEnd(e);
});

can.addEventListener('touchend', e => {
  e.preventDefault();
  mouseEnd(e.touches[0]);
});

can.addEventListener('mousemove', e => {
  mouseMove(e);
}, {passive: true});

can.addEventListener('touchmove', e => {
  e.preventDefault();
  mouseMove(e.touches[0]);
});

colorPicker.addEventListener('input', e => {
  currentColor = colorPicker.value;
});

ariaPicker.addEventListener('input', e => {
  ariaColor = ariaPicker.value;
  document.body.style.backgroundColor = ariaPicker.value;
});

canWidth.addEventListener('input', e => {
  cw = Number(canWidth.value);
  resizeCanvas();
});

canHeight.addEventListener('input', e => {
  ch = Number(canHeight.value);
  resizeCanvas();
});

swScale.addEventListener('input', e => {
  sw = Number(swScale.value);
  resizeCanvas();
});

useBs.addEventListener('click', e => {
  bsMode = useBs.checked;
});

useErase.addEventListener('click', e => {
  eraseMode = useErase.checked;
});

bgImage.addEventListener('input', e => {
  if (!e.target.files[0]) return;
  const objectURL = URL.createObjectURL(e.target.files[0]);
  bgDisplay.style.backgroundImage = `url(${objectURL})`;
  bgDisplay.style.width = can.width + 'px';
  bgDisplay.style.height = can.height + 'px';
});

bgShow.addEventListener('click', e => {
  bgDisplay.classList.toggle('hidden');
});

loadBtn.addEventListener('input', e => {
  if (!e.target.files[0]) return;
  loadFromFile(e.target.files[0]);
});

nameInput.addEventListener('input', (e) => {
  designName = nameInput.value;
  updateSaveLink();
});

draw();

function resizeCanvas() {
  can.width = cw * sw;
  can.height = ch * sw;
  bgDisplay.style.width = can.width + 'px';
  bgDisplay.style.height = can.height + 'px';
  cullOutside();
  draw();
}

function mouseStart(e) {
  mouseDown = true;
  if (eraseMode) {
    if (bsMode) {
      removeBackstitch(e);
    } else {
      removeStitch(e);
    }
  } else {
    if (bsMode) {
      startBackstitch(e);
    } else {
      updateStitch(e);
    }
  }
  draw();
}

function mouseMove(e) {
  if (mouseDown) {
    if (eraseMode) {
      if (bsMode) {
        removeBackstitch(e);
      } else {
        removeStitch(e);
      }
    } else {
      if (bsMode) {
        moveBackstitch(e);
      } else {
        updateStitch(e);
      }
    }
  }
  draw();
}

function mouseEnd(e) {
  mouseDown = false;
  if (bsMode) {
    endBackstitch(e);
  }
  draw();
  updatePalette();
}

function getEventPosition(e, round, exact) {
  const rect = can.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;
  if (exact) {
    return {
      x: cx / sw,
      y: cy / sw
    };
  }
  const x = round ? Math.round(cx / sw) : Math.floor(cx / sw);
  const y = round ? Math.round(cy / sw) : Math.floor(cy / sw);
  return {x, y};
}

function dot(u, v) {
  return u.x * v.x + u.y * v.y;
}

function dist(u, v) {
  return Math.sqrt(Math.pow(v.x - u.x, 2) + Math.pow(v.y - u.y, 2));
}

function distToLineSegment (p, l) {
  // adapted from http://geomalgorithms.com/a02-_lines.html
  const v = { x: l.endX - l.startX, y: l.endY - l.startY };
  const w = { x: p.x - l.startX, y: p.y - l.startY };
  const cOne = dot(w,v);
  const cTwo = dot(v,v);
  if (cOne <= 0) {
    return dist(p, {x: l.startX, y: l.startY});
  }
  if(cTwo <= cOne) {
    return dist(p, {x: l.endX, y: l.endY})
  }
  const divDots = cOne / cTwo;
  const ptB = { x: l.startX + divDots * v.x, y: l.startY + divDots * v.y };
  return dist(p, ptB);
}

function updateStitch(e) {
  const {x, y} = getEventPosition(e);
  const exists = stitches.find(stitch => stitch.x == x && stitch.y == y);
  if (exists) {
    exists.color = currentColor;
  } else {
    stitches.push({x, y, color: currentColor});
  }
}

function startBackstitch(e) {
  const {x, y} = getEventPosition(e, true);
  currentBackstitch = { startX: x, startY: y, endX: x, endY: y, color: currentColor };
}

function moveBackstitch(e) {
  const {x, y} = getEventPosition(e, true);
  const dx = x - currentBackstitch.startX;
  const dy = y - currentBackstitch.startY;
  currentBackstitch.endX = currentBackstitch.startX + Math.sign(dx) * Math.min(3, Math.abs(dx));
  currentBackstitch.endY = currentBackstitch.startY + Math.sign(dy) * Math.min(3, Math.abs(dy));;
}

function endBackstitch(e) {
  if (!currentBackstitch) return;
  if ((currentBackstitch.startX === currentBackstitch.endX) && (currentBackstitch.startY === currentBackstitch.endY)) {
    currentBackstitch = null;
    return;
  }
  const exists = backstitches.find(bs =>
    (currentBackstitch.startX === bs.startX) &&
    (currentBackstitch.startY === bs.startY) &&
    (currentBackstitch.endX === bs.endX) &&
    (currentBackstitch.endY === bs.endY)
  );
  if (exists) {
    exists.color = currentColor;
    currentBackstitch = null;
    return;
  }
  backstitches.push({...currentBackstitch});
  currentBackstitch = null;
}

function removeStitch(e) {
  const {x, y} = getEventPosition(e);
  stitches = stitches.filter(stitch => stitch.x !== x || stitch.y !== y);
}

function removeBackstitch(e) {
  if (!backstitches.length) return;
  const p = getEventPosition(e, false, true);
  // find closest backstitch
  const bsWithDist = backstitches.map((bs, index) => {
    return { dist: distToLineSegment(p, bs), index };
  });
  const byClosest = bsWithDist.sort((a, b) => {
    return Math.sign(a.dist - b.dist);
  });
  const closest = byClosest[0];
  if (closest.dist < 0.25) {
    backstitches.splice(closest.index, 1);
  }
}

function cullOutside() {
  stitches = stitches.filter(stitch => (
    stitch.x < cw &&
    stitch.y < ch
    )
  );
  
  backstitches = backstitches.filter(stitch => (
    !((stitch.startX >= cw &&
    stitch.endX >= cw) ||
    (stitch.startY >= ch &&
    stitch.endY >= ch)
    ))
  );
}

function pickColor(e) {
  colorPicker.value = e.target.value;
  currentColor = e.target.value;
}

function updatePalette() {
  palette.innerHTML = '';
  let colors = [];
  stitches.forEach(stitch => {
    colors.push(stitch.color);
  });
  backstitches.forEach(stitch => {
    colors.push(stitch.color);
  });
  colors = [...new Set(colors)];
  colors.forEach(color => {
    const swatch = document.createElement('button');
    swatch.value = color;
    swatch.classList.add('swatch');
    swatch.style.backgroundColor = color;
    swatch.addEventListener('click', pickColor);
    palette.appendChild(swatch);
  });
}

function updateSaveLink() {
  const ts = Date.now();
  const dataToSave = {
    designName,
    cw,
    ch,
    sw,
    stitches,
    backstitches,
    ariaColor,
    timestamp: ts
  };
  const file = new Blob([JSON.stringify(dataToSave)], { type: 'application/json' });
  saveBtn.href = URL.createObjectURL(file);
  saveBtn.download = `${designName}-${ts}.json`;
}

function loadFromFile(file) {
  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    const jsonData = JSON.parse(loadEvent.target.result);
    designName = jsonData.name || designName;
    cw = jsonData.cw || cw;
    ch = jsonData.ch || ch;
    sw = jsonData.sw || sw;
    stitches = jsonData.stitches || stitches;
    backstitches = jsonData.backstitches || backstitches;
    ariaColor = jsonData.ariaColor || ariaColor;
    canWidth.value = cw;
    canHeight.value = ch;
    swScale.value = sw;
    nameInput.value = designName;
    ariaPicker.value = ariaColor;
    resizeCanvas();
    updatePalette();
  };
  reader.readAsText(file);
}

function draw() {
  can.width = can.width;
  drawStitches();
  drawBackstitches();
  drawCurrentBackstitch();
  drawGrid();
  updateSaveLink();
}

function drawStitches() {
  stitches.forEach(stitch => {
    ctx.fillStyle = stitch.color;
    ctx.fillRect(stitch.x * sw, stitch.y * sw, sw, sw);
  });
}

function drawBackstitches() {
  ctx.lineCap = 'round';
  backstitches.forEach(stitch => {
    ctx.strokeStyle = stitch.color;
    ctx.lineWidth = (sw / 4);
    ctx.beginPath();
    ctx.moveTo(stitch.startX * sw, stitch.startY * sw);
    ctx.lineTo(stitch.endX * sw, stitch.endY * sw);
    ctx.stroke();
  });
}

function drawCurrentBackstitch() {
  if (currentBackstitch == null) return;
  ctx.strokeStyle = currentBackstitch.color;
  ctx.lineWidth = (sw / 4);
  ctx.beginPath();
  ctx.moveTo(currentBackstitch.startX * sw, currentBackstitch.startY * sw);
  ctx.lineTo(currentBackstitch.endX * sw, currentBackstitch.endY * sw);
  ctx.stroke();
}

function drawGrid() {
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i=0; i<can.width; i+=sw) {
    ctx.moveTo(i + 0.5,0);
    ctx.lineTo(i + 0.5, can.height);
  }
  for (let i=0; i<can.height; i+=sw) {
    ctx.moveTo(0, i + 0.5);
    ctx.lineTo(can.width, i + 0.5);
  }
  ctx.stroke();
}