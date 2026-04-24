import * as THREE from 'three';
import {
    SHAPES,
    getSpherePoint,
    getHeartPoint,
    getFlowerPoint,
    getSaturnPoint,
    getFireworksPoint,
    getCrownPoint,
    getWavePoint,
    getVortexPoint,
    getCometPoint,
    getSignaturePoint
} from './shapes.js';

const GOLDEN_RATIO = 0.61803398875;

function createParticleSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);

    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.95)');
    gradient.addColorStop(0.75, 'rgba(255,255,255,0.18)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

function getOriginalParticleSize(deviceProfile) {
    const baseSize = 0.15;
    return baseSize / Math.min(deviceProfile.pixelRatio || 1, 2);
}

export class ParticleSystem {
    constructor(scene, count = 20000, deviceProfile = null) {
        this.scene = scene;
        this.count = count;
        this.particles = new Float32Array(count * 3);
        this.targetPositions = new Float32Array(count * 3);
        this.colors = new Float32Array(count * 3);

        // Store device profile for responsive sizing
        this.deviceProfile = deviceProfile || { width: 1920, height: 1080, pixelRatio: 1, isMobile: false };
        this.responsiveScale = this.calculateResponsiveScale();
        this.visualConfig = this.calculateResponsiveConfig();
        this.seedData = new Float32Array(count * 2);
        this.noiseOffsets = new Float32Array(count);
        this.noiseStrengths = new Float32Array(count);
        this.impulses = new Float32Array(count);

        // Geometry
        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.particles, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

        // Material with responsive particle size
        const sprite = createParticleSprite();
        this.material = new THREE.PointsMaterial({
            size: this.visualConfig.particleSize,
            map: sprite,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            opacity: 0.8
        });

        // Mesh
        this.mesh = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.mesh);

        // State
        this.currentShape = SHAPES.SPHERE;
        this.targetShape = SHAPES.SPHERE;
        this.currentSignature = '00000';
        this.time = 0;
        this.currentExpansion = 1.0;
        this.targetExpansion = 1.0;
        this.centerPosition = new THREE.Vector3(0, 0, 0);
        this.targetCenter = new THREE.Vector3(0, 0, 0);
        this.targetRotation = 0;
        this.currentRotation = 0;
        this.idleTimer = 0;

        // Color theme system
        this.fingerCount = 0;
        this.targetHue = 0;
        this.currentHue = 0;
        this.isRainbowMode = false;

        // Store original scales for responsive adjustment
        this.shapeScales = {
            sphere: 3,
            heart: 3,
            flower: 4,
            saturn: 3.5,
            fireworks: 4,
            crown: 3.8,
            wave: 4,
            vortex: 3.4,
            comet: 3.8,
            signature: 3.6
        };

        this.initParticles();
    }

    calculateViewportFit() {
        const width = this.deviceProfile.width || 1920;
        const height = this.deviceProfile.height || 1080;
        const aspect = width / Math.max(height, 1);
        const fov = THREE.MathUtils.degToRad(this.deviceProfile.cameraFov || 75);
        const cameraZ = this.deviceProfile.cameraZ || 12;
        const visibleHeight = 2 * Math.tan(fov / 2) * cameraZ;
        const visibleWidth = visibleHeight * aspect;
        const minSpan = Math.min(visibleWidth, visibleHeight);
        const fitScale = THREE.MathUtils.clamp(minSpan / 9.5, 0.72, 1);

        return { visibleWidth, visibleHeight, minSpan, fitScale };
    }

    calculateResponsiveScale() {
        const { width, isMobile, isPortrait } = this.deviceProfile;
        const viewportFit = this.calculateViewportFit();
        let baseScale = 1.0;

        if (isMobile || width < 600) {
            baseScale = isPortrait ? 0.9 : 0.96;
        } else if (width < 1024) {
            baseScale = isPortrait ? 0.94 : 0.98;
        }

        return THREE.MathUtils.clamp(baseScale * viewportFit.fitScale, 0.72, 1.0);
    }

    calculateResponsiveConfig() {
        const tier = this.deviceProfile.performanceTier || 'medium';
        const viewportFit = this.calculateViewportFit();
        const isPortrait = Boolean(this.deviceProfile.isPortrait);
        const config = {
            particleSize: getOriginalParticleSize(this.deviceProfile),
            motionStrength: 1,
            wobbleAmplitude: 0.016,
            morphSpeed: 7,
            centerEase: 6,
            expansionEase: 7,
            interactionRadius: 9,
            trackX: viewportFit.visibleWidth * 0.22,
            trackY: viewportFit.visibleHeight * 0.18,
            impulseDecay: 0.9,
            idleSpin: 0.11,
            maxExpansionBoost: 0.55
        };

        if (tier === 'low') {
            config.motionStrength = 0.78;
            config.wobbleAmplitude = 0.009;
            config.morphSpeed = 5.6;
            config.centerEase = 5;
            config.expansionEase = 5.6;
            config.interactionRadius = 7.4;
            config.impulseDecay = 0.84;
            config.idleSpin = 0.08;
        } else if (tier === 'high' || tier === 'ultra') {
            config.motionStrength = 1.05;
            config.wobbleAmplitude = 0.014;
            config.morphSpeed = 7.4;
            config.centerEase = 6.4;
            config.expansionEase = 7.2;
            config.interactionRadius = 9.4;
            config.idleSpin = 0.12;
        }

        if (this.deviceProfile.isMobile) {
            config.trackX = viewportFit.visibleWidth * (isPortrait ? 0.14 : 0.18);
            config.trackY = viewportFit.visibleHeight * (isPortrait ? 0.11 : 0.15);
            config.maxExpansionBoost = isPortrait ? 0.32 : 0.42;
        } else if (this.deviceProfile.isTablet) {
            config.trackX = viewportFit.visibleWidth * (isPortrait ? 0.18 : 0.2);
            config.trackY = viewportFit.visibleHeight * (isPortrait ? 0.14 : 0.17);
            config.maxExpansionBoost = isPortrait ? 0.44 : 0.5;
        }

        return config;
    }

    getCurrentShapeRadius(expansion = 1) {
        const baseScale = this.shapeScales[this.currentShape] || 3;
        const shapeBias = {
            flower: 1.08,
            saturn: 1.14,
            fireworks: 1.18,
            crown: 1.08,
            wave: 1.12,
            signature: 1.14
        };
        const multiplier = shapeBias[this.currentShape] || 1;
        return baseScale * this.responsiveScale * multiplier * expansion;
    }

    clampCenterTarget(x, y, expansion = 1) {
        const viewportFit = this.calculateViewportFit();
        const radius = this.getCurrentShapeRadius(expansion);
        const paddingX = viewportFit.visibleWidth * 0.08;
        const paddingY = viewportFit.visibleHeight * 0.08;
        const maxX = Math.max(0, viewportFit.visibleWidth / 2 - radius - paddingX);
        const maxY = Math.max(0, viewportFit.visibleHeight / 2 - radius - paddingY);

        return {
            x: THREE.MathUtils.clamp(x, -maxX, maxX),
            y: THREE.MathUtils.clamp(y, -maxY, maxY)
        };
    }

    // Update responsive scale when screen resizes
    updateResponsiveScale(newProfile) {
        this.deviceProfile = newProfile;
        this.responsiveScale = this.calculateResponsiveScale();
        this.visualConfig = this.calculateResponsiveConfig();
        this.material.size = this.visualConfig.particleSize;
        this.setShape(this.currentShape, { force: true, signature: this.currentSignature });
    }

    initParticles() {
        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;
            const u = (i * GOLDEN_RATIO) % 1;
            const v = (i + 0.5) / this.count;
            const start = getSpherePoint(u, v, 2.6);

            this.seedData[i * 2] = u;
            this.seedData[i * 2 + 1] = v;
            this.noiseOffsets[i] = u * Math.PI * 2 + v * Math.PI;
            this.noiseStrengths[i] = 0.65 + ((i % 11) / 10) * 0.55;

            this.particles[i3] = start.x;
            this.particles[i3 + 1] = start.y;
            this.particles[i3 + 2] = start.z;

            // Base Colors (Can be dynamic)
            this.colors[i3] = 0.2 + Math.random() * 0.8;
            this.colors[i3 + 1] = 0.1 + Math.random() * 0.5;
            this.colors[i3 + 2] = 0.5 + Math.random() * 0.5;
        }
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;

        this.setShape(SHAPES.HEART, { force: true });
    }

    setShape(shapeType, { force = false, signature = this.currentSignature } = {}) {
        if (this.currentShape === shapeType && this.currentSignature === signature && !force) return;
        this.currentShape = shapeType;
        this.currentSignature = signature;

        // Get base scale for this shape and apply responsive multiplier
        const baseScale = this.shapeScales[shapeType] || 3;
        const finalScale = baseScale * this.responsiveScale;

        // Calculate new targets
        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;
            const u = this.seedData[i * 2];
            const v = this.seedData[i * 2 + 1];

            let pos;
            switch (shapeType) {
                case SHAPES.HEART: pos = getHeartPoint(u, v, finalScale); break;
                case SHAPES.FLOWER: pos = getFlowerPoint(u, v, finalScale); break;
                case SHAPES.SATURN: pos = getSaturnPoint(u, v, finalScale); break;
                case SHAPES.FIREWORKS: pos = getFireworksPoint(u, v, finalScale); break;
                case SHAPES.CROWN: pos = getCrownPoint(u, v, finalScale); break;
                case SHAPES.WAVE: pos = getWavePoint(u, v, finalScale); break;
                case SHAPES.VORTEX: pos = getVortexPoint(u, v, finalScale); break;
                case SHAPES.COMET: pos = getCometPoint(u, v, finalScale); break;
                case SHAPES.SIGNATURE: pos = getSignaturePoint(u, v, finalScale, signature); break;
                default: pos = getSpherePoint(u, v, finalScale);
            }

            this.targetPositions[i3] = pos.x;
            this.targetPositions[i3 + 1] = pos.y;
            this.targetPositions[i3 + 2] = pos.z;
        }
    }

    getCountShape(fingerCount) {
        const countShapes = {
            1: SHAPES.HEART,
            2: SHAPES.FLOWER,
            3: SHAPES.CROWN,
            4: SHAPES.WAVE,
            5: SHAPES.FIREWORKS
        };

        return countShapes[fingerCount] || null;
    }

    getShapeSelection(fingerCount, fingerSignature, gesture) {
        switch (gesture) {
            case 'Pointing_Up':
                return SHAPES.HEART;
            case 'Victory':
                return SHAPES.FLOWER;
            case 'Thumb_Up':
            case 'Rock':
                return SHAPES.SATURN;
            case 'Open_Palm':
                return SHAPES.FIREWORKS;
            default:
                break;
        }

        const countShape = this.getCountShape(fingerCount);
        if (countShape) {
            return countShape;
        }

        switch (fingerSignature) {
            case '00000':
                return SHAPES.VORTEX;
            case '10001':
                return SHAPES.COMET;
            default:
                if (fingerSignature && fingerSignature.includes('1')) {
                    return SHAPES.SIGNATURE;
                }
                return null;
        }
    }

    update(dt, handData) {
        const clampedDt = Math.min(dt, 1 / 20);
        this.time += clampedDt;

        // Velocity-based force variables
        let velocityForceX = 0;
        let velocityForceY = 0;
        let hasVelocity = false;

        // Interaction Logic
        if (handData.detected) {
            // Move center based on hand position
            // Hand coordinates are usually normalized [0,1], map to visible world space [-5, 5] approx
            this.idleTimer = 0;
            const targetX = (0.5 - handData.x) * this.visualConfig.trackX;
            const targetY = (0.5 - handData.y) * this.visualConfig.trackY;

            // Expansion based on pinch
            const pinchStrength = THREE.MathUtils.clamp(
                (handData.pinchDistance - 0.04) * 4.2,
                0,
                this.visualConfig.maxExpansionBoost
            );
            this.targetExpansion = 1.0 + pinchStrength;
            const clampedCenter = this.clampCenterTarget(targetX, targetY, this.targetExpansion);
            this.targetCenter.set(clampedCenter.x, clampedCenter.y, 0);

            // Calculate velocity-based force
            if (handData.velocityX !== undefined && handData.velocityY !== undefined) {
                velocityForceX = -handData.velocityX * this.visualConfig.motionStrength * 0.9;
                velocityForceY = -handData.velocityY * this.visualConfig.motionStrength * 0.9;
                const speed = Math.sqrt(velocityForceX * velocityForceX + velocityForceY * velocityForceY);
                hasVelocity = speed > 0.03;
            }

            // Shape Switching based on Gestures
            const nextShape = this.getShapeSelection(
                handData.fingerCount,
                handData.fingerSignature,
                handData.gesture
            );
            if (nextShape) {
                this.setShape(nextShape, { signature: handData.fingerSignature || '00000' });
            }

            // Update target rotation based on hand tilt
            if (handData.rotationAngle !== undefined) {
                const maxRotation = Math.PI / 3;
                const clampedAngle = Math.max(-maxRotation, Math.min(maxRotation, handData.rotationAngle));
                this.targetRotation = clampedAngle;
            }

            // Update finger count and color theme
            if (handData.fingerCount !== undefined) {
                this.fingerCount = handData.fingerCount;
                if (this.fingerCount === 5) {
                    this.isRainbowMode = true; // All fingers = rainbow mode
                } else {
                    this.isRainbowMode = false;
                    this.targetHue = this.getHueFromFingerCount(this.fingerCount);
                }
            }

        } else {
            this.idleTimer += clampedDt;
            this.targetCenter.set(0, 0, 0);
            this.targetExpansion = 1.0;
            this.targetRotation = 0;

            if (this.idleTimer > 0.8 && this.currentShape !== SHAPES.SPHERE) {
                this.setShape(SHAPES.SPHERE);
            }
        }

        const centerEase = 1 - Math.exp(-clampedDt * this.visualConfig.centerEase);
        const expansionEase = 1 - Math.exp(-clampedDt * this.visualConfig.expansionEase);
        const morphEase = 1 - Math.exp(-clampedDt * this.visualConfig.morphSpeed);

        this.centerPosition.lerp(this.targetCenter, centerEase);
        this.currentExpansion = THREE.MathUtils.lerp(this.currentExpansion, this.targetExpansion, expansionEase);

        // Animate particles
        const positions = this.geometry.attributes.position.array;

        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;

            // Lerp current position to target
            // Apply expansion
            const tx = this.targetPositions[i3] * this.currentExpansion;
            const ty = this.targetPositions[i3 + 1] * this.currentExpansion;
            const tz = this.targetPositions[i3 + 2] * this.currentExpansion;

            // Apply Center Offset
            const finalTx = tx + this.centerPosition.x;
            const finalTy = ty + this.centerPosition.y;
            const finalTz = tz + this.centerPosition.z;

            // Ease towards target
            positions[i3] += (finalTx - positions[i3]) * morphEase;
            positions[i3 + 1] += (finalTy - positions[i3 + 1]) * morphEase;
            positions[i3 + 2] += (finalTz - positions[i3 + 2]) * morphEase;

            // Apply velocity-based force (swipe effect)
            if (hasVelocity) {
                const dx = positions[i3] - this.centerPosition.x;
                const dy = positions[i3 + 1] - this.centerPosition.y;
                const dz = positions[i3 + 2] - this.centerPosition.z;
                const distSq = dx * dx + dy * dy + dz * dz;
                const falloff = 1 / (1 + distSq / this.visualConfig.interactionRadius);
                const forceMultiplier = falloff * clampedDt * 36;

                positions[i3] += velocityForceX * forceMultiplier;
                positions[i3 + 1] += velocityForceY * forceMultiplier;
                this.impulses[i] = Math.min(1.5, this.impulses[i] + falloff * (handData.burstDetected ? 0.26 : 0.12));
            }

            this.impulses[i] *= this.visualConfig.impulseDecay;

            const wobble = this.visualConfig.wobbleAmplitude * this.noiseStrengths[i] * (0.4 + this.impulses[i]);
            const phase = this.noiseOffsets[i];
            positions[i3] += Math.sin(this.time * 1.8 + phase) * wobble * 0.14;
            positions[i3 + 1] += Math.cos(this.time * 1.35 + phase * 0.7) * wobble * 0.1;
            positions[i3 + 2] += Math.sin(this.time * 1.55 + phase * 1.2) * wobble * 0.12;
        }

        this.geometry.attributes.position.needsUpdate = true;

        // Color theme system
        let finalHue;
        if (this.isRainbowMode) {
            // Rainbow mode: cycle through all colors based on time
            finalHue = (this.time * 0.1) % 1;
        } else {
            // Theme mode: smoothly transition to target hue
            this.currentHue = THREE.MathUtils.lerp(this.currentHue, this.targetHue, 0.05);
            finalHue = this.currentHue;
        }
        const color = new THREE.Color().setHSL(finalHue, 0.8, 0.5);
        this.material.color.lerp(color, 0.05);

        // Smoothly interpolate current rotation to target
        this.currentRotation = THREE.MathUtils.lerp(this.currentRotation, this.targetRotation, centerEase);

        // Apply rotations: Y for idle spin, X and Z for hand tilt
        this.mesh.rotation.y = this.time * this.visualConfig.idleSpin + this.currentRotation * 0.14;
        this.mesh.rotation.x = this.currentRotation * 0.38;
        this.mesh.rotation.z = this.currentRotation * 0.24;
    }

    // Get hue based on finger count (color themes)
    getHueFromFingerCount(count) {
        // 0 = no hand (default purple)
        // 1 = Red
        // 2 = Blue
        // 3 = Green
        // 4 = Purple
        // 5 = Rainbow mode (handled separately)
        const hues = {
            0: 0.8,  // Purple (no hand)
            1: 0.0,  // Red
            2: 0.6,  // Blue
            3: 0.3,  // Green
            4: 0.8   // Purple
        };
        return hues[count] !== undefined ? hues[count] : 0.8;
    }
}
