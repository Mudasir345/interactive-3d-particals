import * as THREE from 'three';

export const SHAPES = {
    SPHERE: 'sphere',
    HEART: 'heart',
    FLOWER: 'flower',
    SATURN: 'saturn',
    FIREWORKS: 'fireworks'
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
    // 3D Heart formula
    const theta = u * 2 * Math.PI; // 0 to 2PI
    const phi = v * Math.PI; // 0 to PI

    // Using a parametric heart equation suitable for particles
    const x = 16 * Math.pow(Math.sin(theta), 3);
    const y = 13 * Math.cos(theta) - 5 * Math.cos(2 * theta) - 2 * Math.cos(3 * theta) - Math.cos(4 * theta);
    const z = 2 * Math.cos(phi) * 4; // Add volume

    // Adjust scale and orientation
    return new THREE.Vector3(x * scale * 0.1, y * scale * 0.1, z * scale * 0.1);
}

export function getFlowerPoint(u, v, scale = 1) {
    // Rose/Flower curve derived shape
    const petalCount = 5;
    const theta = u * 2 * Math.PI;
    const phi = v * Math.PI;

    const r = Math.cos(petalCount * theta);
    const x = scale * r * Math.sin(phi) * Math.cos(theta);
    const y = scale * r * Math.sin(phi) * Math.sin(theta);
    const z = scale * Math.cos(phi) * 0.5; // flatten slightly

    return new THREE.Vector3(x, y, z);
}

export function getSaturnPoint(u, v, scale = 1) {
    // Planet body
    if (u < 0.3) {
        const u2 = u / 0.3;
        return getSpherePoint(u2, v, scale * 0.6);
    } else {
        // Rings
        const u_ring = (u - 0.3) / 0.7; // Normalize rest for rings
        const theta = u_ring * 2 * Math.PI * 10; // More density
        const radius = scale * (0.8 + v * 0.8); // Ring width range

        const x = radius * Math.cos(theta);
        const z = radius * Math.sin(theta);
        const y = (Math.random() - 0.5) * 0.1 * scale; // Thin drift

        return new THREE.Vector3(x, y, z);
    }
}

export function getFireworksPoint(u, v, scale = 1) {
    // Burst pattern
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);

    // Add randomness for explosive look
    const randomScale = scale * (0.2 + Math.random() * 0.8 * 2.0); // Spiky

    const x = randomScale * Math.sin(phi) * Math.cos(theta);
    const y = randomScale * Math.sin(phi) * Math.sin(theta);
    const z = randomScale * Math.cos(phi);
    return new THREE.Vector3(x, y, z);
}
