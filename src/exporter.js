import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

export function exportGLB(model, filename) {
    const exporter = new GLTFExporter();
    exporter.parse(
        model,
        (gltf) => {
            const blob = new Blob([gltf], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.style.display = 'none';
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        },
        (error) => {
            console.error('An error happened during export:', error);
            alert('Error exporting GLB');
        },
        { binary: true }
    );
}
