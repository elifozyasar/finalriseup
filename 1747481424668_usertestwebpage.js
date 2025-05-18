
const BASE_X              = 190;
const BASE_Y              = 30;
const STAR_SIZE = 20;
let starredRects = [ 1, 3, 5,10,11,12];
// static width of new rectangles (small like the P-sidebar)
const NEW_RECT_W          = 100;

let   RECT_W              = 280;  // only used for initRectangles()
let   RECT_H, SPACING_Y;         // computed in setup()
const SPACING_X           = 70;
const TASKS_PER_ROW       = 5;
const RESIZE_HANDLE_SIZE  = 10;
const CANCEL_HANDLE_SIZE  = 20;
const NUM_ROWS            = 4;    // P1–P4

const TIMELINE_H          = 40;   // px height of timeline bar
const FOOTER_H            = 200;  // px height of footer block
const FOOTER_GAP          = 10;   // gap between timeline & footer

let ROW_ORIGIN_Y;                 // will be BASE_Y+120
let ROW_HEIGHT;                   // = RECT_H + SPACING_Y

let rectangles = [];
let selectedRectangle = null;
let addButton;
let conflictRects = [];
let dragStart;
let isResizing = false;
let isTyping   = false;
let currentText= '';
let img1, img2;
let trafficRed = false;
let weatherRed = false;

// change this if needed
const STATE_CHANNEL = 'rect_state_channel';
const ROW_LABELS = [
  'Zeynep',
  'Bünyamin',
  'Ömer',
  'Aysel'
];
// ------------------------------------------------------------------
// preload assets
function preload() {
  img1 = loadImage('traffic.png');
  img2 = loadImage('weather.png');
}

// ------------------------------------------------------------------
// setup canvas & compute dynamic sizes
function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  textFont('Arial');       // don’t set size here
  textSize(20);            // pick a comfortable default
  textLeading(24);         // global line‐height
 
 // after your ROW_LABELS

  // figure out how much vertical space for the 4 rows
  ROW_ORIGIN_Y = BASE_Y + 120;
  const availableH = windowHeight
                   - ROW_ORIGIN_Y
                   - TIMELINE_H
                   - FOOTER_GAP
                   - FOOTER_H;

  // 10% of that for gutters, 90% for rect heights:
  SPACING_Y = (availableH * 0.10) / (NUM_ROWS - 1);
  RECT_H     = (availableH * 0.90) / NUM_ROWS;
  ROW_HEIGHT = RECT_H + SPACING_Y;

  // init or load
  if (!loadState()) initRectangles();
  addButton = new Rect(10, 10, 100, 50, true);
  
  // connect to OOCSI
  OOCSI.connect('wss://oocsi.id.tue.nl/ws')
  // subscribe to OOCSI channel to receive state data from another browser
  OOCSI.subscribe(STATE_CHANNEL, (e) => {
    if(e.data.rects) {
      localStorage.setItem('rect_state', JSON.stringify(e.data.rects));
      loadState();
    }
  })
}

// ------------------------------------------------------------------
// handle window resize
function windowResized(){
  resizeCanvas(windowWidth, windowHeight);

  ROW_ORIGIN_Y = BASE_Y + 120;
  const availableH = windowHeight
                   - ROW_ORIGIN_Y
                   - TIMELINE_H
                   - FOOTER_GAP
                   - FOOTER_H;

  SPACING_Y = (availableH * 0.10) / (NUM_ROWS - 1);
  RECT_H     = (availableH * 0.90) / NUM_ROWS;
  ROW_HEIGHT = RECT_H + SPACING_Y;
}

// ------------------------------------------------------------------
// main draw loop
function draw() {
  background(173, 216, 230);

  // current time in hours.fraction
  let nowH = hour() + minute()/60;

  // 1) Grid bottom and timeline Y
  const tasksBottomY = ROW_ORIGIN_Y + (NUM_ROWS - 1) * ROW_HEIGHT + RECT_H;
  const timelineY    = tasksBottomY + SPACING_Y;

  // 2) Footer (half-width, centered) just below the timeline
  const footerY = timelineY + TIMELINE_H + FOOTER_GAP;
  const footerW = width / 2;
  const footerX = (width - footerW) / 2;
  noStroke();
  fill(240, 225, 153);
  rect(footerX, footerY, footerW, FOOTER_H);
  noStroke();
  fill(0);
  textSize(18);
  textStyle(NORMAL);
  textAlign(CENTER, TOP);
  text(
    'paylaşilan aktiviteler',
    footerX + footerW / 2,
    footerY + 10    // 10px down from the top edge of the footer
  );

  // 3) Timeline bar (on top of footer background)
  fill(255);
  stroke(0);
  strokeWeight(2);
  rect(0, timelineY, width, TIMELINE_H);

  // “now” highlight
  let px = constrain(
    map(nowH, /*startH=*/6, /*endH=*/11, 0, width),
    0, width
  );
  noStroke();
  fill(240, 225, 153);
  rect(0, timelineY, px, TIMELINE_H);

  // time labels
  fill(0);
  noStroke();
  textSize(20);
  textAlign(CENTER, CENTER);
  for (let h = 6; h <= 11; h++) {
    for (let m = 0; m < 60; m += 30) {
      let t = h + m/60;
      let x = map(t, 6, 11, 0, width);
      text(nf(h, 2) + ':' + nf(m, 2), x, timelineY + TIMELINE_H / 2);
    }
  }

  // 4) Conflict outlines & Add button
  updateConflicts();
  addButton.displayAdd();

  // — Left sidebar rows
  for (let i = 0; i < NUM_ROWS; i++) {
    let y = ROW_ORIGIN_Y + i * ROW_HEIGHT;
    noStroke();
    fill(240, 225, 153);
    rect(20, y, 100, RECT_H);

    noStroke();
    fill(0);
    textSize(18);
    textStyle(NORMAL);
    textAlign(CENTER, CENTER);
    text(ROW_LABELS[i] || 'P' + (i + 1), 20 + 50, y + RECT_H / 2);
  }

  // — Top-right icons
  stroke(0);
  fill(255);
  strokeWeight(2);
  rect(width - 250, 10, 200, 100);
  image(img1, width - 280, -15, 160, 160);
  stroke(trafficRed ? color(255, 0, 0) : color(0));
  noFill();
  rect(width - 240, 20, 75, 80);
  image(img2, width - 180, -15, 160, 160);
  stroke(weatherRed ? color(255, 0, 0) : color(0));
  noFill();
  rect(width - 140, 20, 75, 80);

  // — Tasks
  let highlightX = constrain(
    map(nowH, 6, 11, BASE_X, width),
    BASE_X, width
  );
  for (let r of rectangles) {
    r.updateAnim();
    r.display(highlightX);
  }

  // — Selected rectangle overlay
  if (selectedRectangle) {
    selectedRectangle.displaySelected();
    selectedRectangle.displayHandles();
  }

  // — Conflict rectangles overlay
  for (let r of conflictRects) {
    noFill();
    stroke(200, 0, 0);
    strokeWeight(3);
    rect(r.x, r.y, r.w, r.h);
  }

  // 5) Text-input box on top of everything
  drawTextInput();
  for (let i = 0; i < rectangles.length; i++) {
  if (starredRects.includes(i)) {
    let r = rectangles[i];
    // draw star at top‐right of rect, with a 5px inset
    fill(225);
    drawStar(r.x + r.w - STAR_SIZE/2 - 5,
             r.y + STAR_SIZE/2 + 5,
             STAR_SIZE);
  }
}
}


// ------------------------------------------------------------------
// Input handlers

function mousePressed() {
  if (mouseButton === RIGHT) {
    for (let r of rectangles) {
      if (r.contains(mouseX, mouseY)) {
        r.useWhiteFill = !r.useWhiteFill;
        r.targetAngle  = r.useWhiteFill ? radians(15) : 0;
        saveState();
        return;
      }
    }
  }
  if (mouseButton === LEFT) {
    dragStart = createVector(mouseX, mouseY);
    // **CREATE A SMALLER NEW RECTANGLE**
    if (addButton.contains(mouseX, mouseY)) {
      let nr = new Rect(
        mouseX - NEW_RECT_W/2,
        mouseY - RECT_H/2,
        NEW_RECT_W,
        RECT_H
      );
      rectangles.push(nr);
      selectRect(nr);
      saveState();
      return;
    }
    if (mouseX<410 && mouseY<110) {
      isTyping = true;
      return;
    }
    for (let r of rectangles) {
      if (r.contains(mouseX, mouseY)) {
        if (r.isOverResizeHandle(mouseX,mouseY)) {
          isResizing = true;
        } else if (r.isOverCancelHandle(mouseX,mouseY)) {
          rectangles = rectangles.filter(o=>o!==r);
          if (r===selectedRectangle) deselect();
          saveState();
        } else {
          selectRect(r);
        }
        return;
      }
    }
    deselect();
    isTyping = false;
  }
}

function mouseDragged() {
  if (!selectedRectangle) return;
  let dx = mouseX - dragStart.x;
  let dy = mouseY - dragStart.y;
  if (isResizing) {
    selectedRectangle.w = max(50, mouseX - selectedRectangle.x);
  } else {
    selectedRectangle.x += dx;
    selectedRectangle.y += dy;
  }
  dragStart.set(mouseX, mouseY);
  // this save state is not needed and will trigger a lot of OOCSI messages
  //saveState();
}
function mouseReleased() {
  let wasResizing = isResizing;
  isResizing = false;
  if (wasResizing && selectedRectangle) {
    saveState();
  }
  if (selectedRectangle) {
    // bottom of the 4th row
    const tasksBottomY = ROW_ORIGIN_Y + (NUM_ROWS-1)*ROW_HEIGHT + RECT_H;
    
    if (selectedRectangle.y < tasksBottomY) {
      // still in the grid → snap into one of the 4 rows
      let row = round((selectedRectangle.y - ROW_ORIGIN_Y) / ROW_HEIGHT);
      row = constrain(row, 0, NUM_ROWS - 1);
      selectedRectangle.y = ROW_ORIGIN_Y + row * ROW_HEIGHT;
      selectedRectangle.ownerIndex = row;      
    }
    
    // clamp horizontally within the canvas (or even within your half-width footer,
    // if you want to stop them from dragging off the sides)
    selectedRectangle.x = constrain(
      selectedRectangle.x,
      0,
      width - selectedRectangle.w
    );

    saveState();
  }
}



function keyPressed() {
  if (!selectedRectangle) return;  // only editing when a rect is selected

  // prevent default for Tab so browser won’t steal focus
  if (keyCode === TAB) {
    keyIsDown = false;
    currentText += '\t';
    selectedRectangle.text = currentText;
    saveState();
    return false;           // prevent browser tabbing away
  }

  switch(keyCode) {
    case BACKSPACE:
      if (currentText.length > 0) {
        currentText = currentText.slice(0, -1);
      }
      break;

    case ENTER:
    case RETURN:
      currentText += '\n';
      break;

    default:
      // only printable single‐char keys
      if (key.length === 1) {
        currentText += key;
      }
  }

  selectedRectangle.text = currentText;
  saveState();
  return false;  // prevents default behavior (like scrolling)
}


function selectRect(r) {
  deselect();
  selectedRectangle = r;
  currentText = r.text;
  isTyping    = true;
}
function deselect() {
  selectedRectangle = null;
  currentText       = '';
  isTyping          = false;
}

function updateConflicts() {
  conflictRects = [];
  for (let i = 0; i < rectangles.length; i++) {
    let r1 = rectangles[i];
    if (!r1.text.trim()) continue;
    for (let j = i + 1; j < rectangles.length; j++) {
      let r2 = rectangles[j];
      if (r1.text !== r2.text) continue;
      if (r1.x < r2.x + r2.w && r1.x + r1.w > r2.x) {
        conflictRects.push(r1, r2);
      }
    }
  }
}

function drawTextInput() {
fill(255);
  stroke(0);
  rect(600, 10, 600, 100);
  noStroke();
  fill(0);
  textSize(16);
  textLeading(20);
  textAlign(LEFT, TOP);
  text(currentText, 610, 20, 580, 80);
  if (isTyping && frameCount % 30 < 15) {
    let cx = 600 + textWidth(currentText) + 20;
    line(cx, 20, cx, 40);
  }
}

function drawTimeline() {
  const y0 = height - TIMELINE_H;
  fill(255); stroke(0); strokeWeight(2);
  rect(0, y0, width, TIMELINE_H);

  let nowH = hour() + minute()/60;
  let px   = constrain(map(nowH, 8, 13, 0, width), 0, width);
  noStroke(); fill(240,225,153);
  rect(0, y0, px, TIMELINE_H);

  fill(0); noStroke(); textSize(20); textAlign(CENTER, CENTER);
  for (let h = 8; h <= 13; h++) {
    for (let m = 0; m < 60; m += 30) {
      let t = h + m/60;
      let x = map(t, 8, 13, 0, width);
      text(nf(h,2)+':'+nf(m,2), x, y0 + TIMELINE_H/2);
    }
  }
}

function saveState() {
  let data = rectangles.map(r=>({
    x:r.x, y:r.y, w:r.w, h:r.h,
    text:r.text,
    useWhiteFill:r.useWhiteFill,
    ownerIndex:r.ownerIndex
  }));
  // correct, you just need to also send the state to OOCSI, see below
  localStorage.setItem('rect_state', JSON.stringify(data));
  OOCSI.send(STATE_CHANNEL, { "rects": data })
}

function loadState() {
  let raw = localStorage.getItem('rect_state');
  if (!raw) return false;
  let arr = JSON.parse(raw);
  rectangles = arr.map(o=>{
    let r = new Rect(o.x, o.y, o.w, o.h);
    r.text         = o.text;
    r.useWhiteFill = o.useWhiteFill;
    r.ownerIndex   = o.ownerIndex;
    return r;
  });
  return true;
}

function initRectangles() {
  rectangles = [];
  for (let i = 0; i < 20; i++){
    let col = i % TASKS_PER_ROW;
    let row = floor(i / TASKS_PER_ROW);
    let x0  = BASE_X + col*(RECT_W + SPACING_X);
    let y0  = ROW_ORIGIN_Y + row*ROW_HEIGHT;
    let r   = new Rect(x0, y0, RECT_W, RECT_H);
    r.ownerIndex = row;
    rectangles.push(r);
  }
}

// ------------------------------------------------------------------
// Rectangle class (unchanged)
class Rect {
  constructor(x,y,w,h, isAdd=false){
    this.x             = x;
    this.y             = y;
    this.w             = w;
    this.h             = h;
    this.isAddButton   = isAdd;
    this.text          = '';
    this.useWhiteFill  = false;
    this.currentAngle  = 0;
    this.targetAngle   = 0;
    this.ownerIndex    = -1;
  }

  updateAnim() {
    this.currentAngle += (this.targetAngle - this.currentAngle) * 0.1;
  }

 display(highlightX) {
  if (this.isAddButton) {
    this.displayAdd();
    return;
  }
  push();
    translate(this.x + this.w/2, this.y + this.h/2);
    rotate(this.currentAngle);
    translate(-this.w/2, -this.h/2);

    // 1) Base fill is always light gray/white
    stroke(0);
    strokeWeight(2);
    fill(225);
    rect(0, 0, this.w, this.h);

    // 2) “Now” highlight overlay
    let fw = constrain(highlightX - this.x, 0, this.w);
    if (fw > 0) {
      fill(this.useWhiteFill ? 255 : color(240,225,153));
      rect(0, 0, fw, this.h);
    }

    // 3) Border (re-draw on top of the highlight)
    noFill();
    stroke(0);
    strokeWeight(2);
    rect(0, 0, this.w, this.h);

    // 4) Multiline, vertically-centered text
    if (this.text) {
      noStroke();
      fill(0);
      textSize(16);
      textLeading(20);
      textAlign(LEFT, TOP);

      const lines  = this.text.split('\n');
      const lh     = textLeading();
      const blockH = lines.length * lh;
      const startY = (this.h - blockH) / 2;

      for (let i = 0; i < lines.length; i++) {
        text(lines[i], 0, startY + i*lh, this.w, lh);
      }
    }
  pop();
}

 displayAdd() {
    fill(255);
    stroke(0);
    strokeWeight(2);
    rect(this.x, this.y, this.w, this.h);
    strokeWeight(3);
    let cx = this.x + this.w/2, cy = this.y + this.h/2;
    line(cx-20, cy, cx+20, cy);
    line(cx, cy-20, cx, cy+20);
  }

  displaySelected() {
    push();
      translate(this.x + this.w/2, this.y + this.h/2);
      rotate(this.currentAngle);
      translate(-this.w/2, -this.h/2);
      noFill();
      stroke(0,0,255);
      strokeWeight(3);
      rect(0,0,this.w,this.h);
    pop();
  }
  displayHandles(){
    push();
      translate(this.x+this.w/2, this.y+this.h/2);
      rotate(this.currentAngle);
      translate(-this.w/2, -this.h/2);
      let hs = RESIZE_HANDLE_SIZE;
      fill(255,0,0); stroke(0);
      rect(this.w-hs, this.h-hs, hs*2, hs*2);
      let cs = CANCEL_HANDLE_SIZE;
      stroke(255,0,0); strokeWeight(3);
      line(-cs,-cs, cs,cs);
      line(cs,-cs, -cs,cs);
    pop();
  }
  contains(px,py){
    return px>=this.x && px<=this.x+this.w &&
           py>=this.y && py<=this.y+this.h;
  }
  isOverResizeHandle(px,py){
    let hs=RESIZE_HANDLE_SIZE;
    return px>=this.x+this.w-hs && px<=this.x+this.w+hs &&
           py>=this.y+this.h-hs && py<=this.y+this.h+hs;
  }
  isOverCancelHandle(px,py){
    let dx = px - this.x, dy = py - this.y;
    return abs(dx)<=CANCEL_HANDLE_SIZE && abs(dy)<=CANCEL_HANDLE_SIZE;
  }
  }
  function drawStar(x, y, size) {
  push();
    translate(x, y);
    stroke(0);
    strokeWeight(2);
    fill(0);
    beginShape();
      for (let i = 0; i < 10; i++) {
        let angle = TWO_PI * i / 10;
        let r     = (i % 2 === 0) ? size/2 : size/5;
        vertex(cos(angle)*r, sin(angle)*r);
      }
    endShape(CLOSE);
  pop();
}

