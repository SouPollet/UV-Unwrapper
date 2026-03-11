import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Xatlas integration logic will be placed here
// Due to pure ESM limitations, we'll manually load the xatlas.js script or create it as needed.

// Basic UI Elements
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-btn');
const actionPanel = document.getElementById('action-panel');
const vertCountSpan = document.getElementById('vert-count');
const faceCountSpan = document.getElementById('face-count');
const unwrapBtn = document.getElementById('unwrap-btn');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const viewToggles = document.getElementById('view-toggles');
const viewOriginalBtn = document.getElementById('view-original-btn');
const viewUnwrappedBtn = document.getElementById('view-unwrapped-btn');
const exportBtn = document.getElementById('export-btn');
const canvasContainer = document.getElementById('canvas-container');
const viewerOverlay = document.getElementById('viewer-overlay');

// Global App State
const state = {
    originalModel: null,
    unwrappedModel: null,
    currentMode: 'original', // 'original' or 'unwrapped'
    isUnwrapping: false,
    xatlasAPI: null
};

// Three.js Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1e2029');

const camera = new THREE.PerspectiveCamera(45, canvasContainer.clientWidth / canvasContainer.clientHeight, 0.1, 100);
camera.position.set(0, 1, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
canvasContainer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Lighting Setup
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight2.position.set(-5, 0, -5);
scene.add(directionalLight2);

// Checkerboard Texture generator
function createCheckerboardTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    
    // Fill white
    context.fillStyle = '#f3f4f6';
    context.fillRect(0, 0, 512, 512);
    
    // Fill black squares
    context.fillStyle = '#6366f1'; // Using primary color for stylish look
    const numSquares = 16;
    const squareSize = 512 / numSquares;
    
    for (let i = 0; i < numSquares; i++) {
        for (let j = 0; j < numSquares; j++) {
            if ((i + j) % 2 === 0) {
                context.fillRect(i * squareSize, j * squareSize, squareSize, squareSize);
            }
        }
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    // texture.repeat.set(4, 4); // Adjust tiling if needed
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

const checkerTexture = createCheckerboardTexture();

// App Logic Functions
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// Resize handler
window.addEventListener('resize', () => {
    camera.aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
});

// File Loading via Drag and Drop / Input
uploadBtn.addEventListener('click', () => fileInput.click());

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
});

dropzone.addEventListener('drop', handleDrop, false);
fileInput.addEventListener('change', handleFileInput);

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    loadFiles(files);
}

function handleFileInput(e) {
    const files = e.target.files;
    loadFiles(files);
}

function loadFiles(files) {
    if (files.length === 0) return;
    const file = files[0];
    if (!file.name.toLowerCase().endsWith('.glb')) {
        alert("Please upload a .glb file.");
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const contents = e.target.result;
        loadGLBFromBuffer(contents);
    };
    reader.readAsArrayBuffer(file);
}

function clearScene() {
    if (state.originalModel) scene.remove(state.originalModel);
    if (state.unwrappedModel) scene.remove(state.unwrappedModel);
    state.originalModel = null;
    state.unwrappedModel = null;
}

function loadGLBFromBuffer(buffer) {
    clearScene();
    viewerOverlay.classList.remove('hidden');
    viewerOverlay.textContent = "Loading Model...";
    
    const loader = new GLTFLoader();
    loader.parse(buffer, '', (gltf) => {
        state.originalModel = gltf.scene;
        
        // Center and scale model fit
        const box = new THREE.Box3().setFromObject(state.originalModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 * Math.tan(fov * 2));
        cameraZ *= 2.5; // padding
        
        camera.position.set(center.x, center.y, cameraZ);
        controls.target.copy(center);
        
        // Extract stats
        let vertices = 0;
        let faces = 0;
        state.originalModel.traverse((child) => {
            if (child.isMesh) {
                vertices += child.geometry.attributes.position.count;
                faces += child.geometry.index ? child.geometry.index.count / 3 : child.geometry.attributes.position.count / 3;
            }
        });
        
        vertCountSpan.textContent = `Vertices: ${vertices.toLocaleString()}`;
        faceCountSpan.textContent = `Faces: ${faces.toLocaleString()}`;
        
        scene.add(state.originalModel);
        viewerOverlay.classList.add('hidden');
        dropzone.classList.add('hidden');
        actionPanel.classList.remove('hidden');
        
        state.currentMode = 'original';
        updateViewToggles();
        
        viewToggles.classList.add('hidden'); // Hide until unwrapped
        
    }, (e) => {
        console.error(e);
        viewerOverlay.textContent = "Error loading model";
    });
}

function updateViewToggles() {
    if (state.currentMode === 'original') {
        viewOriginalBtn.classList.add('active');
        viewUnwrappedBtn.classList.remove('active');
        if (state.originalModel) state.originalModel.visible = true;
        if (state.unwrappedModel) state.unwrappedModel.visible = false;
    } else {
        viewOriginalBtn.classList.remove('active');
        viewUnwrappedBtn.classList.add('active');
        if (state.originalModel) state.originalModel.visible = false;
        if (state.unwrappedModel) state.unwrappedModel.visible = true;
    }
}

viewOriginalBtn.addEventListener('click', () => {
    state.currentMode = 'original';
    updateViewToggles();
});

viewUnwrappedBtn.addEventListener('click', () => {
    if (!state.unwrappedModel) return;
    state.currentMode = 'unwrapped';
    updateViewToggles();
});

import { processModel } from './src/unwrapper.js';
import { exportGLB } from './src/exporter.js';

unwrapBtn.addEventListener('click', async () => {
    if (!state.originalModel || state.isUnwrapping) return;
    
    state.isUnwrapping = true;
    unwrapBtn.disabled = true;
    progressContainer.classList.remove('hidden');
    
    const onProgress = (text) => {
        progressText.textContent = text;
        // Simple faux progress animation since we don't always get exact%
        const currentW = parseFloat(progressBar.style.width || 0);
        if (currentW < 90) progressBar.style.width = (currentW + Math.random() * 5) + '%';
    };

    try {
        // Yield to let UI update before heavy lifting
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const newModel = await processModel(state.originalModel, onProgress);
        
        // Apply checkerboard material to new model
        const checkerMaterial = new THREE.MeshStandardMaterial({ 
            map: checkerTexture,
            roughness: 0.8,
            metalness: 0.1,
            side: THREE.DoubleSide
        });
        
        newModel.traverse((child) => {
            if (child.isMesh) {
                child.material = checkerMaterial;
            }
        });
        
        state.unwrappedModel = newModel;
        scene.add(state.unwrappedModel);
        
        state.currentMode = 'unwrapped';
        updateViewToggles();
        viewToggles.classList.remove('hidden');
        
        progressBar.style.width = '100%';
        progressText.textContent = 'Unwrapping Complete!';
        
    } catch (err) {
        console.error("Unwrapping failed:", err);
        progressText.textContent = 'Error: ' + err.message;
        progressBar.style.backgroundColor = 'var(--success-hover)'; // error color actually
    } finally {
        state.isUnwrapping = false;
        unwrapBtn.disabled = false;
        setTimeout(() => {
            progressContainer.classList.add('hidden');
            progressBar.style.width = '0%';
        }, 3000);
    }
});

exportBtn.addEventListener('click', () => {
    if (!state.unwrappedModel) return;
    exportGLB(state.unwrappedModel, 'unwrapped_model.glb');
});
