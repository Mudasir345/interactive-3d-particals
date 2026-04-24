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
    const aspect = width / Math.max(height, 1);
    const pixelRatio = window.devicePixelRatio || 1;
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4;
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isMobile = width < 768 || (isTouch && width < 1024);
    const isTablet = !isMobile && width < 1180;
    const isPortrait = height > width;
    const area = width * height;
    let performanceTier = 'high';

    if (isMobile || memory <= 4 || cores <= 4) {
        performanceTier = 'low';
    } else if (isTablet || pixelRatio > 2 || memory <= 6) {
        performanceTier = 'medium';
    } else if (area > 2500000 && cores >= 8 && memory >= 8) {
        performanceTier = 'ultra';
    }

    let particleCount = 16000;
    let cameraZ = 13;
    let cameraFov = 72;
    let maxPixelRatio = Math.min(pixelRatio, 1.8);
    let previewScale = 1;

    if (performanceTier === 'low') {
        particleCount = isMobile ? 6500 : 8000;
        cameraZ = isMobile ? 9.5 : 10.5;
        cameraFov = isMobile ? 82 : 78;
        maxPixelRatio = Math.min(pixelRatio, 1.2);
        previewScale = isMobile ? 0.82 : 0.9;
    } else if (performanceTier === 'medium') {
        particleCount = isTablet ? 11000 : 12000;
        cameraZ = isTablet ? 11.2 : 12;
        cameraFov = 76;
        maxPixelRatio = Math.min(pixelRatio, 1.5);
        previewScale = isTablet ? 0.95 : 0.9;
    } else if (performanceTier === 'ultra') {
        particleCount = 22000;
        cameraZ = 14.5;
        cameraFov = 70;
        maxPixelRatio = Math.min(pixelRatio, 2);
        previewScale = 1.02;
    }

    if (isMobile && isPortrait) {
        cameraZ += 1.4;
        cameraFov = Math.min(88, cameraFov + 2);
        previewScale *= 0.88;
    } else if (isTablet && isPortrait) {
        cameraZ += 0.8;
        cameraFov = Math.min(84, cameraFov + 1);
    }

    return {
        particleCount,
        cameraZ,
        cameraFov,
        aspect,
        isMobile,
        isTablet,
        isPortrait,
        width,
        height,
        pixelRatio,
        maxPixelRatio,
        performanceTier,
        previewScale
    };
}

const deviceProfile = getDeviceProfile();

// Scene Setup
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.02);

// Camera with responsive position
const camera = new THREE.PerspectiveCamera(deviceProfile.cameraFov, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = deviceProfile.cameraZ;

// Renderer
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: deviceProfile.performanceTier !== 'low',
  alpha: true,
  powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(deviceProfile.maxPixelRatio);

// --- System Modules ---
const particles = new ParticleSystem(scene, deviceProfile.particleCount, deviceProfile);
const handInput = new HandInput(deviceProfile);

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

  particles.update(dt, {
    detected: handInput.detected,
    x: handInput.x,
    y: handInput.y,
    velocityX: handInput.velocityX,
    velocityY: handInput.velocityY,
    rotationAngle: handInput.rotationAngle,
    fingerCount: handInput.fingerCount,
    fingerSignature: handInput.fingerSignature,
    burstDetected: handInput.burstDetected,
    pinchDistance: handInput.pinchDistance,
    gesture: handInput.gesture
  });

  renderer.render(scene, camera);
}

// --- Resize Handler ---
let resizeFrame = 0;

function syncViewport() {
  const nextProfile = getDeviceProfile();

  camera.aspect = nextProfile.width / nextProfile.height;
  camera.fov = nextProfile.cameraFov;
  camera.position.z = nextProfile.cameraZ;
  camera.updateProjectionMatrix();
  renderer.setSize(nextProfile.width, nextProfile.height);
  renderer.setPixelRatio(nextProfile.maxPixelRatio);

  particles.updateResponsiveScale(nextProfile);
  handInput.updateResponsiveLayout(nextProfile);
}

window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(syncViewport);
});

start();
