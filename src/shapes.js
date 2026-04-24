import * as THREE from 'three';

export const SHAPES = {
    SPHERE: 'sphere',
    HEART: 'heart',
    FLOWER: 'flower',
    SATURN: 'saturn',
    FIREWORKS: 'fireworks',
    CROWN: 'crown',
    WAVE: 'wave',
    VORTEX: 'vortex',
    COMET: 'comet',
    SIGNATURE: 'signature'
};

// --- Shape Calculation Functions ---

export function getSpherePoint(u, v, scale = 1) {
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const x = scale * Math.sin(phi) * Math.cos(theta);
    const y = scale * Math.sin(phi) * Math.sin(theta);
    const z = scale * Math.cos(phi);
    return new THREE.Vector3(x, y, z);
}

export function getHeartPoint(u, v, scale = 1) {
    const theta = u * 2 * Math.PI;
    const phi = v * Math.PI;
    const x = 16 * Math.pow(Math.sin(theta), 3);
    const y = 13 * Math.cos(theta) - 5 * Math.cos(2 * theta) - 2 * Math.cos(3 * theta) - Math.cos(4 * theta);
    const z = 2 * Math.cos(phi) * 4;

    return new THREE.Vector3(x * scale * 0.1, y * scale * 0.1, z * scale * 0.1);
}

export function getFlowerPoint(u, v, scale = 1) {
    const petalCount = 5;
    const theta = u * 2 * Math.PI;
    const phi = v * Math.PI;
    const r = Math.cos(petalCount * theta);
    const x = scale * r * Math.sin(phi) * Math.cos(theta);
    const y = scale * r * Math.sin(phi) * Math.sin(theta);
    const z = scale * Math.cos(phi) * 0.5;

    return new THREE.Vector3(x, y, z);
}

export function getSaturnPoint(u, v, scale = 1) {
    if (u < 0.3) {
        const u2 = u / 0.3;
        return getSpherePoint(u2, v, scale * 0.6);
    }

    const uRing = (u - 0.3) / 0.7;
    const theta = uRing * 2 * Math.PI * 10;
    const radius = scale * (0.8 + v * 0.8);
    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;
    const y = (Math.random() - 0.5) * 0.1 * scale;

    return new THREE.Vector3(x, y, z);
}

export function getFireworksPoint(u, v, scale = 1) {
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const randomScale = scale * (0.2 + Math.random() * 0.8 * 2.0);
    const x = randomScale * Math.sin(phi) * Math.cos(theta);
    const y = randomScale * Math.sin(phi) * Math.sin(theta);
    const z = randomScale * Math.cos(phi);

    return new THREE.Vector3(x, y, z);
}

export function getCrownPoint(u, v, scale = 1) {
    const spikes = 3;
    const theta = u * Math.PI * 2;
    const ring = 0.65 + 0.35 * v;
    const spikeWave = Math.pow(Math.max(0, Math.cos(theta * spikes)), 2);
    const radius = scale * (0.55 + ring * 0.45 + spikeWave * 0.4);
    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;
    const y = scale * (-0.55 + v * 0.75 + spikeWave * 0.7);

    return new THREE.Vector3(x, y, z);
}

export function getWavePoint(u, v, scale = 1) {
    const theta = u * Math.PI * 2;
    const arc = -1 + 2 * u;
    const width = scale * (1.15 + 0.35 * Math.cos(v * Math.PI));
    const x = arc * width;
    const y = Math.sin(theta * 2) * scale * 0.42 + (v - 0.5) * scale * 1.4;
    const z = Math.cos(theta) * scale * (0.35 + v * 0.4);

    return new THREE.Vector3(x, y, z);
}

export function getVortexPoint(u, v, scale = 1) {
    const turns = 3.5;
    const theta = u * Math.PI * 2 * turns;
    const radius = scale * (0.18 + v * 0.75);
    const tightening = 1 - v * 0.35;
    const x = Math.cos(theta) * radius * tightening;
    const y = (v - 0.5) * scale * 3;
    const z = Math.sin(theta) * radius;

    return new THREE.Vector3(x, y, z);
}

export function getCometPoint(u, v, scale = 1) {
    if (u < 0.34) {
        const head = getSpherePoint(u / 0.34, v, scale * 0.72);
        head.x += scale * 0.75;
        return head;
    }

    const trailT = (u - 0.34) / 0.66;
    const theta = v * Math.PI * 2;
    const spread = scale * (0.1 + trailT * 1.15);
    const x = scale * (0.75 - trailT * 2.7);
    const y = Math.sin(theta) * spread * 0.42;
    const z = Math.cos(theta) * spread * (0.45 + trailT * 0.35);

    return new THREE.Vector3(x, y, z);
}

export function getSignaturePoint(u, v, scale = 1, signature = '00000') {
    const bits = signature.split('').map(Number);
    const activeCount = bits.reduce((sum, bit) => sum + bit, 0);
    const signatureCode = parseInt(signature, 2);
    const theta = u * Math.PI * 2;
    const phi = v * Math.PI * 2;
    const lobeCount = 3 + ((signatureCode + activeCount) % 5);
    const majorRadius = scale * (0.5 + activeCount * 0.08 + bits[0] * 0.06 - bits[4] * 0.03);
    const tubeRadius = scale * (0.16 + bits[3] * 0.04 + bits[2] * 0.03 + v * 0.24);
    const orbitTwist = theta + (v - 0.5) * Math.PI * (0.45 + bits[1] * 0.55 + bits[4] * 0.35);
    const wave = 1
        + 0.18 * Math.sin(theta * lobeCount + phi * (1 + bits[0] + bits[2]))
        + 0.08 * Math.cos(theta * (2 + bits[3]) - phi * (1 + bits[4]));
    const innerWave = phi * (2 + bits[1] + bits[3]) + theta * 0.5;
    const x = Math.cos(orbitTwist) * majorRadius * wave + Math.cos(innerWave) * tubeRadius;
    const z = Math.sin(orbitTwist) * majorRadius * wave + Math.sin(innerWave) * tubeRadius;
    const yBase = (v - 0.5) * scale * (1.15 + bits[2] * 0.7 + bits[4] * 0.4);
    const yWave = Math.sin(theta * (2 + bits[0] + bits[3]) + phi) * scale * 0.2 * (0.8 + bits[1] * 0.4);
    const y = yBase + yWave;

    return new THREE.Vector3(
        x + bits[0] * scale * 0.14 - bits[4] * scale * 0.1,
        y + bits[2] * scale * 0.08 - bits[3] * scale * 0.05,
        z + bits[1] * scale * 0.12
    );
}
