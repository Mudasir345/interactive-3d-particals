import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export class HandInput {
    constructor(deviceProfile = null) {
        this.deviceProfile = deviceProfile || { isMobile: false, previewScale: 1 };
        this.handLandmarker = undefined;
        this.video = null;
        this.runningMode = 'VIDEO';
        this.detected = false;
        this.x = 0.5;
        this.y = 0.5;
        this.rawX = 0.5;
        this.rawY = 0.5;
        this.velocityX = 0;
        this.velocityY = 0;
        this.rotationAngle = 0;
        this.fingerCount = 0;
        this.fingerStates = this.createEmptyFingerStates();
        this.fingerSignature = '00000';
        this.pinchDistance = 0;
        this.gesture = null;
        this.lastVideoTime = -1;
        this.lastTimestamp = 0;
        this.gestureCandidate = null;
        this.gestureCandidateFrames = 0;
        this.requiredGestureFrames = 3;
        this.signatureCandidate = '00000';
        this.signatureCandidateFrames = 0;
        this.requiredSignatureFrames = 2;
        this.burstDetected = false;
        this.burstTimer = 0;
        this.burstThreshold = 1.15;
        this.burstDuration = 0.18;
        this.smoothing = {
            position: 0.22,
            rotation: 0.18,
            pinch: 0.2,
            velocity: 0.28,
            release: 0.12
        };
    }

    async init() {
        const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
        );

        this.handLandmarker = await this.createLandmarker(vision);
        await this.setupCamera();
    }

    async createLandmarker(vision) {
        const baseOptions = {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
        };

        try {
            return await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    ...baseOptions,
                    delegate: 'GPU'
                },
                runningMode: this.runningMode,
                numHands: 1
            });
        } catch (error) {
            return HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    ...baseOptions,
                    delegate: 'CPU'
                },
                runningMode: this.runningMode,
                numHands: 1
            });
        }
    }

    async setupCamera() {
        this.video = document.createElement('video');
        this.video.setAttribute('playsinline', '');
        this.video.id = 'camera-preview';
        this.video.style.position = 'fixed';
        this.video.style.zIndex = '100';
        this.video.style.objectFit = 'cover';
        this.video.style.transform = 'scaleX(-1)';
        this.video.style.backgroundColor = '#000';
        this.video.style.opacity = '0';
        this.video.style.transition = 'opacity 0.5s ease';
        this.video.style.pointerEvents = 'none';
        this.video.style.borderRadius = '18px';
        this.video.style.border = '1px solid rgba(255, 255, 255, 0.18)';
        this.video.style.boxShadow = '0 16px 40px rgba(0, 0, 0, 0.35)';
        this.video.style.backdropFilter = 'blur(10px)';
        document.body.appendChild(this.video);
        this.updateResponsiveLayout(this.deviceProfile);

        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user',
                width: { ideal: this.deviceProfile.isMobile ? 480 : 640 },
                height: { ideal: this.deviceProfile.isMobile ? 360 : 480 }
            }
        });
        this.video.srcObject = stream;

        return new Promise((resolve) => {
            this.video.onloadedmetadata = () => {
                this.video.play();
                setTimeout(() => {
                    this.video.style.opacity = '1';
                }, 100);
                resolve();
            };
        });
    }

    updateResponsiveLayout(deviceProfile) {
        this.deviceProfile = deviceProfile;

        if (!this.video) {
            return;
        }

        const scale = deviceProfile.previewScale || 1;
        const width = Math.round(180 * scale);
        const height = Math.round(135 * scale);
        const inset = deviceProfile.isMobile ? 12 : 20;

        this.video.style.width = `${width}px`;
        this.video.style.height = `${height}px`;
        this.video.style.right = `${inset}px`;
        this.video.style.bottom = `${inset}px`;
    }

    update() {
        if (!this.handLandmarker || !this.video || this.video.paused) {
            return;
        }

        if (this.video.currentTime === this.lastVideoTime) {
            return;
        }

        const now = performance.now();
        const deltaSeconds = this.lastTimestamp
            ? Math.min((now - this.lastTimestamp) / 1000, 0.05)
            : 1 / 60;
        this.lastTimestamp = now;
        this.lastVideoTime = this.video.currentTime;

        const results = this.handLandmarker.detectForVideo(this.video, now);
        const landmarks = results.landmarks[0];

        if (!landmarks) {
            this.releaseState(deltaSeconds);
            return;
        }

        this.detected = true;
        const handedness = results.handednesses?.[0]?.[0]?.categoryName || 'Right';
        const states = this.getFingerStates(landmarks, handedness);
        const signature = this.getFingerSignature(states);
        const nextX = landmarks[8].x;
        const nextY = landmarks[8].y;
        const prevX = this.x;
        const prevY = this.y;

        this.rawX = nextX;
        this.rawY = nextY;
        this.x = this.lerp(this.x, nextX, this.smoothing.position);
        this.y = this.lerp(this.y, nextY, this.smoothing.position);

        const targetVelocityX = (this.x - prevX) / Math.max(deltaSeconds, 1 / 120);
        const targetVelocityY = (this.y - prevY) / Math.max(deltaSeconds, 1 / 120);
        this.velocityX = this.lerp(this.velocityX, targetVelocityX, this.smoothing.velocity);
        this.velocityY = this.lerp(this.velocityY, targetVelocityY, this.smoothing.velocity);

        const wrist = landmarks[0];
        const indexTip = landmarks[8];
        const rawAngle = Math.atan2(indexTip.y - wrist.y, indexTip.x - wrist.x) + Math.PI / 2;
        this.rotationAngle = this.lerp(this.rotationAngle, rawAngle, this.smoothing.rotation);

        const dx = landmarks[4].x - landmarks[8].x;
        const dy = landmarks[4].y - landmarks[8].y;
        const rawPinch = Math.sqrt(dx * dx + dy * dy);
        this.pinchDistance = this.lerp(this.pinchDistance, rawPinch, this.smoothing.pinch);

        this.updateSignatureStability(states, signature);

        const nextGesture = this.recognizeGesture(this.fingerStates);
        this.updateGestureStability(nextGesture);

        this.fingerCount = this.calculateFingerCount(this.fingerStates);
        this.updateBurstState(deltaSeconds);
    }

    releaseState(deltaSeconds) {
        this.detected = false;
        this.gesture = null;
        this.gestureCandidate = null;
        this.gestureCandidateFrames = 0;
        this.signatureCandidate = '00000';
        this.signatureCandidateFrames = 0;
        this.fingerStates = this.createEmptyFingerStates();
        this.fingerSignature = '00000';
        this.velocityX = this.lerp(this.velocityX, 0, this.smoothing.release);
        this.velocityY = this.lerp(this.velocityY, 0, this.smoothing.release);
        this.rotationAngle = this.lerp(this.rotationAngle, 0, this.smoothing.release);
        this.pinchDistance = this.lerp(this.pinchDistance, 0, this.smoothing.release);
        this.fingerCount = 0;
        this.burstTimer = Math.max(0, this.burstTimer - deltaSeconds);
        this.burstDetected = this.burstTimer > 0;
    }

    updateGestureStability(nextGesture) {
        if (nextGesture === this.gestureCandidate) {
            this.gestureCandidateFrames += 1;
        } else {
            this.gestureCandidate = nextGesture;
            this.gestureCandidateFrames = 1;
        }

        if (this.gestureCandidateFrames >= this.requiredGestureFrames) {
            this.gesture = this.gestureCandidate;
        }
    }

    updateSignatureStability(states, signature) {
        if (signature === this.signatureCandidate) {
            this.signatureCandidateFrames += 1;
        } else {
            this.signatureCandidate = signature;
            this.signatureCandidateFrames = 1;
        }

        if (this.signatureCandidateFrames >= this.requiredSignatureFrames) {
            this.fingerStates = { ...states };
            this.fingerSignature = signature;
        }
    }

    updateBurstState(deltaSeconds) {
        const velocityMagnitude = Math.sqrt(
            this.velocityX * this.velocityX + this.velocityY * this.velocityY
        );

        if (velocityMagnitude > this.burstThreshold) {
            this.burstTimer = this.burstDuration;
        } else {
            this.burstTimer = Math.max(0, this.burstTimer - deltaSeconds);
        }

        this.burstDetected = this.burstTimer > 0;
    }

    recognizeGesture(states) {
        const { thumb, index, middle, ring, pinky } = states;

        if (thumb && index && middle && ring && pinky) return 'Open_Palm';
        if (thumb && !index && !middle && !ring && !pinky) return 'Thumb_Up';
        if (!thumb && !index && !middle && !ring && !pinky) return 'Fist';
        if (index && middle && !ring && !pinky) return 'Victory';
        if (index && !middle && !ring && !pinky && !thumb) return 'Pointing_Up';
        if (index && pinky && !middle && !ring) return 'Rock';

        return null;
    }

    getFingerStates(landmarks, handedness) {
        const thumbDirection = handedness === 'Left' ? -1 : 1;
        const thumbExtendedHorizontal = (landmarks[4].x - landmarks[2].x) * thumbDirection > 0.03;
        const thumbExtendedVertical = landmarks[4].y < landmarks[3].y - 0.02;

        return {
            thumb: thumbExtendedHorizontal || thumbExtendedVertical,
            index: landmarks[8].y < landmarks[6].y - 0.015,
            middle: landmarks[12].y < landmarks[10].y - 0.015,
            ring: landmarks[16].y < landmarks[14].y - 0.015,
            pinky: landmarks[20].y < landmarks[18].y - 0.015
        };
    }

    calculateFingerCount(states) {
        return ['thumb', 'index', 'middle', 'ring', 'pinky'].reduce(
            (count, finger) => count + (states[finger] ? 1 : 0),
            0
        );
    }

    getFingerSignature(states) {
        return ['thumb', 'index', 'middle', 'ring', 'pinky']
            .map((finger) => (states[finger] ? '1' : '0'))
            .join('');
    }

    createEmptyFingerStates() {
        return {
            thumb: false,
            index: false,
            middle: false,
            ring: false,
            pinky: false
        };
    }

    lerp(current, target, alpha) {
        return current + (target - current) * alpha;
    }
}
