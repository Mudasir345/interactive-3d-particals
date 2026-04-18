import * as THREE from 'three';
import { SHAPES, getSpherePoint, getHeartPoint, getFlowerPoint, getSaturnPoint, getFireworksPoint } from './shapes.js';

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

        // Geometry
        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.particles, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

        // Material with responsive particle size
        const sprite = new THREE.TextureLoader().load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/sprites/disc.png');
        const baseSize = 0.15;
        // Larger particles on mobile for visibility, smaller on high-DPI
        const responsiveSize = this.deviceProfile.isMobile ? baseSize * 1.3 : baseSize / Math.min(this.deviceProfile.pixelRatio, 2);

        this.material = new THREE.PointsMaterial({
            size: responsiveSize,
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
        this.transitionSpeed = 0.05;
        this.time = 0;
        this.expansion = 1.0;
        this.centerPosition = new THREE.Vector3(0, 0, 0);
        this.targetRotation = 0; // Desired rotation from hand tilt
        this.currentRotation = 0; // Current smoothed rotation

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
            fireworks: 4
        };

        this.initParticles();
    }

    // Calculate responsive scale multiplier based on screen size
    calculateResponsiveScale() {
        const { width, isMobile } = this.deviceProfile;
        if (isMobile || width < 600) {
            return 0.7; // Smaller shapes on mobile
        } else if (width < 1024) {
            return 0.85; // Medium shapes on tablet
        }
        return 1.0; // Full size on desktop
    }

    // Update responsive scale when screen resizes
    updateResponsiveScale(newProfile) {
        this.deviceProfile = newProfile;
        this.responsiveScale = this.calculateResponsiveScale();
        // Recalculate target positions for current shape with new scale
        this.setShape(this.currentShape);
    }

    initParticles() {
        // Initialize random positions
        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;
            this.particles[i3] = (Math.random() - 0.5) * 10;
            this.particles[i3 + 1] = (Math.random() - 0.5) * 10;
            this.particles[i3 + 2] = (Math.random() - 0.5) * 10;

            // Base Colors (Can be dynamic)
            this.colors[i3] = 0.2 + Math.random() * 0.8;
            this.colors[i3 + 1] = 0.1 + Math.random() * 0.5;
            this.colors[i3 + 2] = 0.5 + Math.random() * 0.5;
        }
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;

        this.setShape(SHAPES.HEART); // Start with Heart
    }

    setShape(shapeType) {
        if (this.currentShape === shapeType) return;
        this.currentShape = shapeType;

        // Get base scale for this shape and apply responsive multiplier
        const baseScale = this.shapeScales[shapeType] || 3;
        const finalScale = baseScale * this.responsiveScale;

        // Calculate new targets
        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;
            // Use random sampling for surface distribution
            const u = Math.random();
            const v = Math.random();

            let pos;
            switch (shapeType) {
                case SHAPES.HEART: pos = getHeartPoint(u, v, finalScale); break;
                case SHAPES.FLOWER: pos = getFlowerPoint(u, v, finalScale); break;
                case SHAPES.SATURN: pos = getSaturnPoint(u, v, finalScale); break;
                case SHAPES.FIREWORKS: pos = getFireworksPoint(u, v, finalScale); break;
                default: pos = getSpherePoint(u, v, finalScale);
            }

            this.targetPositions[i3] = pos.x;
            this.targetPositions[i3 + 1] = pos.y;
            this.targetPositions[i3 + 2] = pos.z;
        }
    }

    update(dt, handData) {
        this.time += dt;

        // Velocity-based force variables
        let velocityForceX = 0;
        let velocityForceY = 0;
        let hasVelocity = false;

        // Interaction Logic
        if (handData.detected) {
            // Move center based on hand position
            // Hand coordinates are usually normalized [0,1], map to visible world space [-5, 5] approx
            const targetX = (0.5 - handData.x) * 10; // Invert X for mirror feel
            const targetY = (0.5 - handData.y) * 8;

            this.centerPosition.lerp(new THREE.Vector3(targetX, targetY, 0), 0.1);

            // Expansion based on pinch
            const targetExpansion = 1.0 + (handData.pinchDistance * 5); // 0 to 1 range typically
            this.expansion = THREE.MathUtils.lerp(this.expansion, targetExpansion, 0.1);

            // Calculate velocity-based force
            if (handData.velocityX !== undefined && handData.velocityY !== undefined) {
                // Scale velocity to meaningful force (amplified)
                velocityForceX = -handData.velocityX * 50; // Invert X for mirror feel
                velocityForceY = -handData.velocityY * 50;
                const speed = Math.sqrt(velocityForceX * velocityForceX + velocityForceY * velocityForceY);
                hasVelocity = speed > 0.01; // Threshold to avoid jitter
            }

            // Shape Switching based on Gestures
            if (handData.gesture) {
                if (handData.gesture === 'Pointing_Up') this.setShape(SHAPES.HEART);
                else if (handData.gesture === 'Victory') this.setShape(SHAPES.FLOWER);
                else if (handData.gesture === 'Thumb_Up' || handData.gesture === 'Rock') this.setShape(SHAPES.SATURN); // Rock/Saturn mapping
                else if (handData.gesture === 'Open_Palm') this.setShape(SHAPES.FIREWORKS);
            }

            // Update target rotation based on hand tilt
            if (handData.rotationAngle !== undefined) {
                // Clamp rotation to reasonable range (-60 to +60 degrees in radians)
                const maxRotation = Math.PI / 3; // 60 degrees
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
            // Idle movement
            this.centerPosition.lerp(new THREE.Vector3(0, 0, 0), 0.05);
            this.expansion = THREE.MathUtils.lerp(this.expansion, 1.0, 0.05);
            this.targetRotation = 0; // Reset rotation when no hand
        }

        // Animate particles
        const positions = this.geometry.attributes.position.array;

        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;

            // Lerp current position to target
            // Apply expansion
            const tx = this.targetPositions[i3] * this.expansion;
            const ty = this.targetPositions[i3 + 1] * this.expansion;
            const tz = this.targetPositions[i3 + 2] * this.expansion;

            // Apply Center Offset
            const finalTx = tx + this.centerPosition.x;
            const finalTy = ty + this.centerPosition.y;
            const finalTz = tz + this.centerPosition.z;

            // Ease towards target
            positions[i3] += (finalTx - positions[i3]) * this.transitionSpeed;
            positions[i3 + 1] += (finalTy - positions[i3 + 1]) * this.transitionSpeed;
            positions[i3 + 2] += (finalTz - positions[i3 + 2]) * this.transitionSpeed;

            // Apply velocity-based force (swipe effect)
            if (hasVelocity) {
                // Calculate distance from hand center for falloff effect
                const dx = positions[i3] - this.centerPosition.x;
                const dy = positions[i3 + 1] - this.centerPosition.y;
                const dz = positions[i3 + 2] - this.centerPosition.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                // Closer particles get more force, farther get less
                const falloff = Math.max(0, 1 - dist / 10);
                const forceMultiplier = falloff * 0.3; // Scale down the force
                
                positions[i3] += velocityForceX * forceMultiplier;
                positions[i3 + 1] += velocityForceY * forceMultiplier;
            }

            // Add subtle noise/wave
            positions[i3] += Math.sin(this.time * 2 + positions[i3 + 1]) * 0.01;
            positions[i3 + 1] += Math.cos(this.time * 1.5 + positions[i3]) * 0.01;
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
        this.currentRotation = THREE.MathUtils.lerp(this.currentRotation, this.targetRotation, 0.1);

        // Apply rotations: Y for idle spin, X and Z for hand tilt
        this.mesh.rotation.y = this.time * 0.1; // Idle Y rotation
        this.mesh.rotation.x = this.currentRotation * 0.5; // Tilt forward/back
        this.mesh.rotation.z = this.currentRotation * 0.3; // Slight tilt side-to-side
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
