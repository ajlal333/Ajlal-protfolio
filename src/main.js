import './styles.css';
import * as THREE from 'three';

const canvas = document.querySelector('#webgl');

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xfcfbf3, 0.028);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 1.4, 8.2);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const palette = {
  blue: new THREE.Color('#2c6fff'),
  cream: new THREE.Color('#fcfbf3'),
  amber: new THREE.Color('#ffb454'),
  mint: new THREE.Color('#34c9a5'),
  coral: new THREE.Color('#ff6b6b'),
  ink: new THREE.Color('#181818'),
};

const solutionCopy = {
  automation: {
    color: palette.blue,
    title: 'AI automation for business operations',
    copy:
      'Convert repeatable internal work into AI-assisted workflows with prompts, structured outputs, APIs, and human review.',
  },
  extraction: {
    color: palette.amber,
    title: 'Structured data from messy sources',
    copy:
      'Use agentic browsing, semantic analysis, and recovery logic to turn websites, documents, and public data into usable business records.',
  },
  platform: {
    color: palette.mint,
    title: 'Production AI platforms',
    copy:
      'Launch FastAPI services for model inference, async jobs, file processing, access control, observability, and ongoing iteration.',
  },
};

let activeSolution = 'automation';
const pointer = new THREE.Vector2();
const target = new THREE.Vector2();

const group = new THREE.Group();
scene.add(group);

const tesseractVertices = [];
[-1, 1].forEach((x) => {
  [-1, 1].forEach((y) => {
    [-1, 1].forEach((z) => {
      [-1, 1].forEach((w) => {
        tesseractVertices.push({ x, y, z, w });
      });
    });
  });
});

const tesseractEdges = [];
for (let a = 0; a < tesseractVertices.length; a += 1) {
  for (let b = a + 1; b < tesseractVertices.length; b += 1) {
    const left = tesseractVertices[a];
    const right = tesseractVertices[b];
    const differences =
      Number(left.x !== right.x) +
      Number(left.y !== right.y) +
      Number(left.z !== right.z) +
      Number(left.w !== right.w);
    if (differences === 1) tesseractEdges.push([a, b]);
  }
}

const tesseractPositions = new Float32Array(tesseractEdges.length * 2 * 3);
const tesseractGeometry = new THREE.BufferGeometry();
tesseractGeometry.setAttribute(
  'position',
  new THREE.BufferAttribute(tesseractPositions, 3)
);

const tesseractMaterial = new THREE.LineBasicMaterial({
  color: '#2c6fff',
  transparent: true,
  opacity: 0.46,
});
const tesseract = new THREE.LineSegments(tesseractGeometry, tesseractMaterial);
group.add(tesseract);

const nodeMaterial = new THREE.MeshBasicMaterial({
  color: '#2c6fff',
  transparent: true,
  opacity: 0.78,
});
const tesseractNodes = tesseractVertices.map(() => {
  const node = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), nodeMaterial);
  group.add(node);
  return node;
});

function rotatePlane(a, b, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [a * cos - b * sin, a * sin + b * cos];
}

function projectTesseractVertex(vertex, elapsed) {
  let { x, y, z, w } = vertex;
  [x, w] = rotatePlane(x, w, elapsed * 0.42);
  [y, w] = rotatePlane(y, w, elapsed * 0.31);
  [z, w] = rotatePlane(z, w, elapsed * 0.24);
  [x, y] = rotatePlane(x, y, elapsed * 0.08);

  const distance = 3.25;
  const projection = distance / (distance - w);
  return new THREE.Vector3(
    x * projection * 1.55,
    y * projection * 1.55,
    z * projection * 1.55
  );
}

function updateTesseract(elapsed, color) {
  const projected = tesseractVertices.map((vertex) =>
    projectTesseractVertex(vertex, elapsed)
  );

  tesseractEdges.forEach(([start, end], edgeIndex) => {
    const offset = edgeIndex * 6;
    const a = projected[start];
    const b = projected[end];
    tesseractPositions[offset] = a.x;
    tesseractPositions[offset + 1] = a.y;
    tesseractPositions[offset + 2] = a.z;
    tesseractPositions[offset + 3] = b.x;
    tesseractPositions[offset + 4] = b.y;
    tesseractPositions[offset + 5] = b.z;
  });

  projected.forEach((position, index) => {
    tesseractNodes[index].position.copy(position);
    tesseractNodes[index].scale.setScalar(1 + Math.sin(elapsed * 2.2 + index) * 0.16);
  });

  tesseractGeometry.attributes.position.needsUpdate = true;
  tesseractMaterial.color.lerp(color, 0.045);
  nodeMaterial.color.lerp(color, 0.045);
}

const particleCount = 520;
const positions = new Float32Array(particleCount * 3);
const colors = new Float32Array(particleCount * 3);
const base = [palette.blue, palette.amber, palette.mint, palette.coral];

for (let i = 0; i < particleCount; i += 1) {
  const radius = 3.8 + Math.random() * 8.5;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
  positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.5;
  positions[i * 3 + 2] = radius * Math.cos(phi);

  const color = base[i % base.length].clone().lerp(palette.cream, 0.26);
  colors[i * 3] = color.r;
  colors[i * 3 + 1] = color.g;
  colors[i * 3 + 2] = color.b;
}

const particleGeometry = new THREE.BufferGeometry();
particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
const particles = new THREE.Points(
  particleGeometry,
  new THREE.PointsMaterial({
    size: 0.034,
    vertexColors: true,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  })
);
scene.add(particles);

const keyLight = new THREE.PointLight('#2c6fff', 2.3, 18);
keyLight.position.set(-3, 4, 4);
scene.add(keyLight);

const warmLight = new THREE.PointLight('#ffb454', 1.6, 16);
warmLight.position.set(4, -2, 4);
scene.add(warmLight);

scene.add(new THREE.AmbientLight('#ffffff', 1.9));

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setSolution(solution) {
  activeSolution = solution;
  const data = solutionCopy[solution];
  document.querySelectorAll('[data-solution]').forEach((element) => {
    element.classList.toggle('active', element.dataset.solution === solution);
  });
  setText('solution-title', data.title);
  setText('solution-copy', data.copy);
}

const bookingRecipient = 'ajlalgoraya333@gmail.com';
const bookingDialog = document.getElementById('booking-dialog');
const bookingForm = document.getElementById('booking-form');
const formStatus = document.getElementById('form-status');

function setFormStatus(message, tone = 'neutral') {
  if (!formStatus) return;
  formStatus.textContent = message;
  formStatus.dataset.tone = tone;
}

function openBookingDialog() {
  if (!bookingDialog) return;
  if (typeof bookingDialog.showModal === 'function') {
    bookingDialog.showModal();
  } else {
    bookingDialog.setAttribute('open', '');
  }
  document.body.classList.add('modal-open');
  setFormStatus('');
  bookingDialog.querySelector('input, select, textarea')?.focus();
}

function closeBookingDialog() {
  if (!bookingDialog) return;
  if (typeof bookingDialog.close === 'function') {
    bookingDialog.close();
  } else {
    bookingDialog.removeAttribute('open');
  }
  document.body.classList.remove('modal-open');
}

function buildFallbackMailto(payload) {
  const subject = `AI strategy call request from ${payload.company || payload.name}`;
  const body = [
    'New AI strategy call request',
    '',
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Company: ${payload.company}`,
    `Website: ${payload.website || 'Not provided'}`,
    `AI need: ${payload.service}`,
    `Preferred call window: ${payload.callWindow}`,
    '',
    'Workflow details:',
    payload.message,
  ].join('\n');

  return `mailto:${bookingRecipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

document.querySelectorAll('[data-open-booking]').forEach((button) => {
  button.addEventListener('click', openBookingDialog);
});

document.querySelectorAll('[data-close-booking]').forEach((button) => {
  button.addEventListener('click', closeBookingDialog);
});

bookingDialog?.addEventListener('click', (event) => {
  if (event.target === bookingDialog) closeBookingDialog();
});

bookingDialog?.addEventListener('close', () => {
  document.body.classList.remove('modal-open');
});

bookingForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const submitButton = bookingForm.querySelector('button[type="submit"]');
  const payload = Object.fromEntries(new FormData(bookingForm).entries());

  if (payload.companyFax) return;

  submitButton.disabled = true;
  setFormStatus('Sending your call request...', 'neutral');

  try {
    const response = await fetch('/api/book-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Booking email service unavailable');
    }

    bookingForm.reset();
    setFormStatus('Request sent. I will reply with call details soon.', 'success');
  } catch (error) {
    window.location.href = buildFallbackMailto(payload);
    setFormStatus('Your email app should open with the request ready to send.', 'neutral');
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelectorAll('[data-solution]').forEach((element) => {
  element.addEventListener('click', () => setSolution(element.dataset.solution));
  element.addEventListener('pointerenter', () => setSolution(element.dataset.solution));
});

document.querySelectorAll('.faq-item').forEach((item) => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.faq-item').forEach((other) => {
      if (other !== item) other.classList.remove('active');
    });
    item.classList.toggle('active');
  });
});

window.addEventListener('scroll', () => {
  document.body.classList.toggle('scrolled', window.scrollY > 34);
});

window.addEventListener('pointermove', (event) => {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

setSolution(activeSolution);

const clock = new THREE.Clock();

function animate() {
  const elapsed = clock.getElapsedTime();
  const solution = solutionCopy[activeSolution];
  target.lerp(pointer, 0.05);

  group.rotation.y = elapsed * 0.12 + target.x * 0.26;
  group.rotation.x = target.y * 0.14;
  updateTesseract(elapsed, solution.color);

  particles.rotation.y = elapsed * 0.014 + target.x * 0.035;
  particles.rotation.x = target.y * 0.02;

  camera.position.x += (target.x * 0.55 - camera.position.x) * 0.03;
  camera.position.y += (1.4 + target.y * 0.28 - camera.position.y) * 0.03;
  camera.lookAt(0, 0.15, 0);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
