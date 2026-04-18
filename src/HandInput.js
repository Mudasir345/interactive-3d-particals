import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export class HandInput {
    constructor() {
        this.handLandmarker = undefined;
        this.video = null;
        this.runningMode = 'VIDEO';
        this.detected = false;
        this.x = 0.5;
        this.y = 0.5;
        this.prevX = 0.5;
        this.prevY = 0.5;
        this.velocityX = 0;
        this.velocityY = 0;
        this.rotationAngle = 0; // Hand tilt angle in radians
        this.fingerCount = 0; // Number of fingers up
        this.pinchDistance = 0;
        this.gesture = null;
        this.lastVideoTime = -1;

        // Burst detection
        this.burstDetected = false;
        this.burstTimer = 0;
        this.burstThreshold = 0.15; // Velocity threshold for burst
        this.burstDuration = 0.5; // Seconds burst stays active
    }

    async init() {
        const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
        );

        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
                delegate: 'GPU'
            },
            runningMode: this.runningMode,
            numHands: 1
        });

        await this.setupCamera();
    }

    async setupCamera() {
        this.video = document.createElement('video');
        this.video.setAttribute('playsinline', '');
        this.video.id = 'camera-preview';
        this.video.style.position = 'fixed';
        this.video.style.bottom = '20px';
        this.video.style.right = '20px';
        this.video.style.width = '200px';
        this.video.style.height = '150px';
        this.video.style.borderRadius = '12px';
        this.video.style.border = '2px solid rgba(255, 255, 255, 0.3)';
        this.video.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.5)';
        this.video.style.zIndex = '100';
        this.video.style.objectFit = 'cover';
        this.video.style.transform = 'scaleX(-1)'; // Mirror effect
        this.video.style.backgroundColor = '#000';
        this.video.style.opacity = '0';
        this.video.style.transition = 'opacity 0.5s ease';
        this.video.style.pointerEvents = 'none';
        document.body.appendChild(this.video);

        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }
        });
        this.video.srcObject = stream;

        return new Promise((resolve) => {
            this.video.onloadedmetadata = () => {
                this.video.play();
                // Show camera preview after it starts playing
                setTimeout(() => {
                    this.video.style.opacity = '1';
                }, 100);
                resolve();
            };
        });
    }

    update() {
        if (!this.handLandmarker || !this.video || this.video.paused) return;

        // Only process if video has advanced
        if (this.video.currentTime !== this.lastVideoTime) {
            this.lastVideoTime = this.video.currentTime;
            const results = this.handLandmarker.detectForVideo(this.video, performance.now());

            if (results.landmarks.length > 0) {
                this.detected = true;
                const landmarks = results.landmarks[0];

                // Save previous positions for velocity calculation
                this.prevX = this.x;
                this.prevY = this.y;

                // Use Index Finger Tip (8) for position tracking
                this.x = landmarks[8].x;
                this.y = landmarks[8].y;

                // Calculate Velocity (change in position)
                this.velocityX = this.x - this.prevX;
                this.velocityY = this.y - this.prevY;

                // Burst Detection - check for quick/flick movement
                const velocityMagnitude = Math.sqrt(
                    this.velocityX * this.velocityX + this.velocityY * this.velocityY
                );
                if (velocityMagnitude > this.burstThreshold) {
                    this.burstDetected = true;
                    this.burstTimer = this.burstDuration; // Reset timer
                }

                // Decay burst timer (approx 60fps, so dt ~ 0.016)
                if (this.burstTimer > 0) {
                    this.burstTimer -= 0.016; // Approximate frame time
                    if (this.burstTimer <= 0) {
                        this.burstDetected = false;
                        this.burstTimer = 0;
                    }
                }

                // Calculate Rotation Angle (Wrist 0 to Index Tip 8)
                const wrist = landmarks[0];
                const indexTip = landmarks[8];
                const angleRad = Math.atan2(indexTip.y - wrist.y, indexTip.x - wrist.x);
                // Normalize: upright hand = 0, tilt left = positive, tilt right = negative
                // atan2 returns -PI to PI, we want roughly -90 to +90 degrees
                this.rotationAngle = angleRad + Math.PI / 2; // Offset so upright is 0

                // Calculate Pinch (Thumb Tip 4 to Index Tip 8)
                const dx = landmarks[4].x - landmarks[8].x;
                const dy = landmarks[4].y - landmarks[8].y;
                this.pinchDistance = Math.sqrt(dx * dx + dy * dy);

                // Simple Gesture Logic
                this.gesture = this.recognizeGesture(landmarks);

                // Calculate finger count for color control
                this.fingerCount = this.calculateFingerCount(landmarks);
            } else {
                this.detected = false;
                this.gesture = null;
                this.velocityX = 0;
                this.velocityY = 0;
                this.rotationAngle = 0;
                this.fingerCount = 0;
                this.burstDetected = false;
                this.burstTimer = 0;
            }
        }
    }

    recognizeGesture(landmarks) {
        // Finger States (Up if tip y < pip y)
        const isThumbUp = landmarks[4].x < landmarks[3].x; // Relative for left/right? Simplified
        const isIndexUp = landmarks[8].y < landmarks[6].y;
        const isMiddleUp = landmarks[12].y < landmarks[10].y;
        const isRingUp = landmarks[16].y < landmarks[14].y;
        const isPinkyUp = landmarks[20].y < landmarks[18].y;

        let upCount = 0;
        if (isIndexUp) upCount++;
        if (isMiddleUp) upCount++;
        if (isRingUp) upCount++;
        if (isPinkyUp) upCount++;

        // Mappings
        if (upCount === 4) return 'Open_Palm'; // Fireworks
        if (isIndexUp && isMiddleUp && !isRingUp && !isPinkyUp) return 'Victory'; // Flower
        if (isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) return 'Pointing_Up'; // Heart
        if (upCount === 0) return 'Fist';
        // Rock/Saturn: Index and Pinky up
        if (isIndexUp && isPinkyUp && !isMiddleUp && !isRingUp) return 'Rock'; // Saturn (actually called Rock above, mapped to Thumb_Up in Particle System, let's fix that map)

        // Let's use Thumb_Up as a proxy for "Thumbs UP" gesture if possible, but detection is tricky.
        // Returning 'Rock' for now
        return 'Rock';
    }

    calculateFingerCount(landmarks) {
        // Check each finger (Up if tip y < pip y, except thumb which uses x)
        const isThumbUp = landmarks[4].x < landmarks[3].x;
        const isIndexUp = landmarks[8].y < landmarks[6].y;
        const isMiddleUp = landmarks[12].y < landmarks[10].y;
        const isRingUp = landmarks[16].y < landmarks[14].y;
        const isPinkyUp = landmarks[20].y < landmarks[18].y;

        let count = 0;
        if (isThumbUp) count++;
        if (isIndexUp) count++;
        if (isMiddleUp) count++;
        if (isRingUp) count++;
        if (isPinkyUp) count++;

        return count;
    }
}
