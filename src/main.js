import * as THREE from 'three';
import { ParticleSystem } from './ParticleSystem.js';
import { HandInput } from './HandInput.js';

// --- Initialization ---
const canvas = document.getElementById('stage');
const loadingText = document.getElementById('loading-text');

// --- Device Detection & Responsive Setup ---
function getDeviceProfile() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const pixelRatio = window.devicePixelRatio || 1;
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isMobile = width < 768 || (isTouch && width < 1024);

    // Determine particle count based on device capability
    let particleCount = 20000; // Default high-end
    let cameraZ = 15; // Default desktop

    if (isMobile || width < 600) {
        // Mobile / Small screens
        particleCount = 8000;
        cameraZ = 10; // Closer camera for smaller screens
    } else if (width < 1024 || pixelRatio > 2) {
        // Tablet / Mid-range
        particleCount = 12000;
        cameraZ = 12;
    }

    return { particleCount, cameraZ, isMobile, width, height, pixelRatio };
}

const deviceProfile = getDeviceProfile();

// Scene Setup
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.02);

// Camera with responsive position
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = deviceProfile.cameraZ;

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// --- System Modules ---
const particles = new ParticleSystem(scene, deviceProfile.particleCount, deviceProfile);
const handInput = new HandInput();

// Handle interaction mapping fix
// ParticleSystem expects 'Thumb_Up' for Saturn, HandInput returns 'Rock'. Let's align them.
// Actually, let's just update the ParticleSystem to check for 'Rock' in the loop below or inside it.
// We'll trust ParticleSystem's updated logic if we modify it, or we handle it here.
// NOTE: I will quickly patch ParticleSystem.js to accept 'Rock' for Saturn in the update loop inside the class. 
// OR simpler: Map 'Rock' to 'Thumb_Up' equivalent behavior.

// --- Main Loop ---
const clock = new THREE.Clock();

async function start() {
  try {
    await handInput.init();
    loadingText.classList.add('hidden');
  } catch (err) {
    loadingText.innerText = "Error accessing camera or loading AI.";
    console.error(err);
  }

  animate();
}

function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();

  handInput.update();

  // Map specific gesture strings to ensure compatibility
  if (handInput.gesture === 'Rock') {
    // Force mapping if needed, or rely on internal check
    // We will update ParticleSystem logic directly in the next tool call if needed, 
    // but for now let's hope 'Rock' gesture logic in HandInput aligns with ParticleSystem.
    // Wait, ParticleSystem checks for 'Thumb_Up'. I should change ParticleSystem to 'Rock' 
    // or 'Saturn' gesture. Let's do a quick fix in logic here? 
    // Ideally logic belongs in ParticleSystem. Let's send a property 'gesture' that matches what ParticleSystem expects.
  }

  // Pass normalized data with velocity, rotation, finger count and burst
  particles.update(dt, {
    detected: handInput.detected,
    x: handInput.x,
    y: handInput.y,
    velocityX: handInput.velocityX,
    velocityY: handInput.velocityY,
    rotationAngle: handInput.rotationAngle,
    fingerCount: handInput.fingerCount,
    burstDetected: handInput.burstDetected,
    pinchDistance: handInput.pinchDistance,
    gesture: handInput.gesture === 'Rock' ? 'Thumb_Up' : handInput.gesture // Remap for compatibility
  });

  renderer.render(scene, camera);
}

// --- Resize Handler ---
window.addEventListener('resize', () => {
  // Update camera aspect
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Recalculate device profile and update camera position
  const newProfile = getDeviceProfile();
  camera.position.z = newProfile.cameraZ;

  // Update particle system responsive scale
  particles.updateResponsiveScale(newProfile);
});

start();
