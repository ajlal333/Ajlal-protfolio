import './styles.css';
import * as THREE from 'three';
import blogContent from '../content/blog-posts.json';
import { initializeBooking } from './booking.js';

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
    title: 'Agentic workflows for business operations',
    copy: 'Coordinate agents, business rules, integrations, and human review in one dependable flow.',
  },
  extraction: {
    color: palette.amber,
    title: 'Grounded decision intelligence',
    copy: 'Turn documents and business context into traceable, bounded decisions.',
  },
  platform: {
    color: palette.mint,
    title: 'AI platforms and integrations',
    copy: 'Connect workflows to APIs, MCP tools, dashboards, auth, and deployment.',
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

initializeBooking();

const homeBlogGrid = document.querySelector('[data-home-blog]');

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function formatBlogDate(date) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`));
}

function createHomeBlogCard(post, index) {
  const card = createElement('a', `home-blog-card${index === 0 ? ' featured' : ''}`);
  card.href = `/blog/?post=${encodeURIComponent(post.slug)}`;
  card.setAttribute('aria-label', `Read ${post.title}`);

  if (index === 0 && post.image) {
    const visual = createElement('div', 'home-blog-visual');
    const image = document.createElement('img');
    image.src = post.image;
    image.alt = post.imageAlt || '';
    image.loading = 'lazy';
    visual.append(image);
    card.append(visual);
  } else {
    const signal = createElement('div', 'home-blog-signal');
    signal.setAttribute('aria-hidden', 'true');
    signal.append(
      createElement('span', '', String(index + 1).padStart(2, '0')),
      createElement('i'),
      createElement('i'),
      createElement('i')
    );
    card.append(signal);
  }

  const body = createElement('div', 'home-blog-body');
  const meta = createElement('div', 'home-blog-meta');
  meta.append(
    createElement('span', '', post.category),
    createElement('time', '', formatBlogDate(post.published))
  );

  const title = createElement('h3', '', post.title);
  const excerpt = createElement('p', '', post.excerpt);
  const footer = createElement('div', 'home-blog-footer');
  footer.append(
    createElement('span', '', post.readTime),
    createElement('b', '', '->')
  );
  body.append(meta, title, excerpt, footer);
  card.append(body);

  return card;
}

if (homeBlogGrid) {
  blogContent.posts
    .slice(0, 3)
    .forEach((post, index) => homeBlogGrid.append(createHomeBlogCard(post, index)));
}

document.querySelectorAll('[data-solution]').forEach((element) => {
  element.addEventListener('click', () => setSolution(element.dataset.solution));
  element.addEventListener('pointerenter', () => setSolution(element.dataset.solution));
});

const projectTabs = [...document.querySelectorAll('[data-project-tab]')];
const projectPanels = [...document.querySelectorAll('[data-project-panel]')];

function setActiveProject(projectId, focusTab = false) {
  projectTabs.forEach((tab) => {
    const isActive = tab.dataset.projectTab === projectId;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
    if (isActive && focusTab) tab.focus();
  });

  projectPanels.forEach((panel) => {
    const isActive = panel.dataset.projectPanel === projectId;
    panel.hidden = !isActive;
    panel.classList.toggle('active', isActive);
  });
}

projectTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => setActiveProject(tab.dataset.projectTab));
  tab.addEventListener('keydown', (event) => {
    const navigationKeys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
    if (!navigationKeys.includes(event.key)) return;

    event.preventDefault();
    let nextIndex = index;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = (index + 1) % projectTabs.length;
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + projectTabs.length) % projectTabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = projectTabs.length - 1;
    }

    setActiveProject(projectTabs[nextIndex].dataset.projectTab, true);
  });
});

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const supportsFinePointer = window.matchMedia('(pointer: fine)').matches;

if (!prefersReducedMotion && supportsFinePointer) {
  document.querySelectorAll('.project-visual').forEach((visual) => {
    visual.addEventListener('pointermove', (event) => {
      const bounds = visual.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width;
      const y = (event.clientY - bounds.top) / bounds.height;
      visual.style.setProperty('--visual-x', `${x * 100}%`);
      visual.style.setProperty('--visual-y', `${y * 100}%`);
      visual.style.setProperty('--visual-rotate-x', `${(0.5 - y) * 2.2}deg`);
      visual.style.setProperty('--visual-rotate-y', `${(x - 0.5) * 2.2}deg`);
    });

    visual.addEventListener('pointerleave', () => {
      visual.style.setProperty('--visual-rotate-x', '0deg');
      visual.style.setProperty('--visual-rotate-y', '0deg');
    });
  });
}

document.querySelectorAll('.faq-item').forEach((item) => {
  item.setAttribute('aria-expanded', String(item.classList.contains('active')));
  item.addEventListener('click', () => {
    document.querySelectorAll('.faq-item').forEach((other) => {
      if (other !== item) {
        other.classList.remove('active');
        other.setAttribute('aria-expanded', 'false');
      }
    });
    item.classList.toggle('active');
    item.setAttribute('aria-expanded', String(item.classList.contains('active')));
  });
});

const sectionLinks = [...document.querySelectorAll('.nav-links a[href^="#"]')];
const linkedSections = sectionLinks
  .map((link) => document.querySelector(link.getAttribute('href')))
  .filter(Boolean);

if ('IntersectionObserver' in window) {
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      const visibleEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      if (!visibleEntry) return;

      sectionLinks.forEach((link) => {
        link.classList.toggle('current', link.getAttribute('href') === `#${visibleEntry.target.id}`);
      });
    },
    { rootMargin: '-24% 0px -58% 0px', threshold: [0.01, 0.2, 0.45] }
  );
  linkedSections.forEach((section) => sectionObserver.observe(section));
}

window.addEventListener('scroll', () => {
  document.body.classList.toggle('scrolled', window.scrollY > 34);
});

document.body.classList.toggle('scrolled', window.scrollY > 34);

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
