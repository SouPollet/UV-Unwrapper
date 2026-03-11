
import * as THREE from 'three';

export async function processModel(sourceGltf, onProgress) {
    if (!xatlasModule) {
        onProgress('Initializing xatlas.js module...');

        xatlasModule = new window.XAtlas.XAtlasAPI(
            () => {
                console.log('xatlas.js loaded');
            },
            (path, dir) => {
                if (path === "xatlas_web.wasm") return "xatlas_web.wasm";
                return dir + path;
            },
            (mode, progress) => {
                onProgress(`Atlas Progress - Mode: ${mode}, ${progress}%`);
            }
        );

        while (!xatlasModule.loaded) {
            await new Promise(r => setTimeout(r, 100)); // wait for load
        }
    }

    onProgress('Gathering meshes...');

    // We need to clone the model so we don't mess up the original
    const newModel = sourceGltf.clone(true);
    const meshesToProcess = [];

    newModel.traverse((child) => {
        if (child.isMesh && child.geometry) {
            meshesToProcess.push(child);
        }
    });

    if (meshesToProcess.length === 0) {
        throw new Error("No meshes found in model");
    }

    onProgress(`Found ${meshesToProcess.length} meshes. Creating atlas...`);

    const atlas = xatlasModule;
    atlas.createAtlas();

    let processedCount = 0;

    for (const mesh of meshesToProcess) {
        const geometry = mesh.geometry;

        let positionAttr = geometry.getAttribute('position');
        let indexAttr = geometry.getIndex();

        if (!positionAttr) continue;

        let vertices = new Float32Array(positionAttr.array);
        let indices;

        if (indexAttr) {
            indices = new Uint16Array(indexAttr.array);
        } else {
            // Generate non-indexed indices
            indices = new Uint16Array(positionAttr.count);
            for (let i = 0; i < positionAttr.count; i++) indices[i] = i;
        }

        // Add mesh to atlas
        atlas.addMesh(indices, vertices);

        processedCount++;
        onProgress(`Added mesh ${processedCount}/${meshesToProcess.length} to atlas...`);
    }

    onProgress('Generating Atlas (this might take a while)...');

    // Generate Atlas
    // the XAtlasAPI wrapper returns an array of processed meshes
    const generatedMeshes = atlas.generateAtlas({
        // Chart options
        fixWinding: false,
        maxChartArea: 0,
        maxBoundaryLength: 0,
        normalDeviationWeight: 2,
        roundnessWeight: 0.01,
        straightnessWeight: 6,
        normalSeamWeight: 4,
        textureSeamWeight: 0.5,
        maxCost: 2,
        maxIterations: 1,
    }, {
        // Pack Options
        bilinear: true,
        blockAlign: false,
        bruteForce: false,
        createImage: false,
        maxChartSize: 0,
        padding: 0,
        resolution: 1024,
        rotateCharts: true,
        rotateChartsToAxis: true,
        texelsPerUnit: 0
    });

    onProgress('Rebuilding geometries with new UVs...');

    // Reconstruct
    for (let i = 0; i < meshesToProcess.length; i++) {
        const originalMesh = meshesToProcess[i];
        const genData = generatedMeshes[i];

        if (!genData) {
            console.warn(`No generated data for mesh ${originalMesh.name}`);
            continue;
        }

        const newGeometry = new THREE.BufferGeometry();

        // Rebuild attributes using oldIndexes map
        const vertexCount = genData.vertexCount;
        const oldIndexes = genData.oldIndexes;
        const newCoords = genData.vertex.coords; // Unwrapped UVs

        // We must map all old attributes to the new vertex count
        const origAttributes = originalMesh.geometry.attributes;
        const oldPos = origAttributes.position;
        const newPos = new Float32Array(vertexCount * 3);

        for (let j = 0; j < vertexCount; j++) {
            const oldIdx = oldIndexes[j];
            newPos[j * 3] = oldPos.getX(oldIdx);
            newPos[j * 3 + 1] = oldPos.getY(oldIdx);
            newPos[j * 3 + 2] = oldPos.getZ(oldIdx);
        }
        newGeometry.setAttribute('position', new THREE.BufferAttribute(newPos, 3));

        // Add new UVs
        newGeometry.setAttribute('uv', new THREE.BufferAttribute(newCoords, 2));

        // Transfer normal if available
        if (origAttributes.normal) {
            const oldNorm = origAttributes.normal;
            const newNorm = new Float32Array(vertexCount * 3);
            for (let j = 0; j < vertexCount; j++) {
                const oldIdx = oldIndexes[j];
                newNorm[j * 3] = oldNorm.getX(oldIdx);
                newNorm[j * 3 + 1] = oldNorm.getY(oldIdx);
                newNorm[j * 3 + 2] = oldNorm.getZ(oldIdx);
            }
            newGeometry.setAttribute('normal', new THREE.BufferAttribute(newNorm, 3));
        }

        // Set new index
        newGeometry.setIndex(new THREE.BufferAttribute(genData.index, 1));

        originalMesh.geometry.dispose(); // Free old memory
        originalMesh.geometry = newGeometry;
    }

    atlas.destroyAtlas();

    onProgress('Unwrapping complete!');
    return newModel;
}

let xatlasModule = null;
