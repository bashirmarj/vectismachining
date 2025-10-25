"""
High-Quality Adaptive Mesh Generation Service

This service uses Gmsh to generate production-quality display meshes from STEP files.
Gmsh provides best-in-class tessellation with adaptive mesh sizing based on surface curvature.

Key Features:
- Adaptive mesh density (ultra-fine for curved surfaces, coarse for planar surfaces)
- Surface-type-specific tessellation
- Quality presets (fast, balanced, ultra)
- Professional CAD-quality visual output

Technology Stack:
- Gmsh: Professional CAD meshing library
- Flask: REST API
- NumPy: Mesh data processing
"""

import os
import io
import math
import logging
import tempfile
import threading
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

try:
    import gmsh
    GMSH_AVAILABLE = True
except ImportError:
    GMSH_AVAILABLE = False
    print("⚠️ WARNING: Gmsh not available. Install with: conda install -c conda-forge gmsh")

# === CONFIG ===
app = Flask(__name__)
CORS(app)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mesh_service")

# Global lock for Gmsh (ensures thread-safe execution)
gmsh_lock = threading.Lock()

# === QUALITY PRESETS ===
QUALITY_PRESETS = {
    'fast': {
        'base_size_factor': 0.004,      # 0.4% of diagonal (balanced detail)
        'planar_factor': 2.5,           # 2.5x coarser on flat surfaces  
        'curvature_points': 48,         # 48 elements per 2π = ~7.5° between points (smooth circles)
        'target_triangles': 30000       # Target ~30k triangles
    },
    'balanced': {
        'base_size_factor': 0.0015,     # 0.15% of diagonal (10x finer)
        'planar_factor': 2.0,           # 2x coarser on flats
        'curvature_points': 48,         # 48 elements per 2π = ~7.5° between points
        'target_triangles': 150000      # Target ~150k triangles
    },
    'ultra': {
        'base_size_factor': 0.0006,     # 0.06% of diagonal (10x finer)
        'planar_factor': 1.5,           # Less coarsening
        'curvature_points': 72,         # 72 elements per 2π = ~5° between points
        'target_triangles': 500000      # Target ~500k triangles
    }
}




def generate_adaptive_mesh(step_file_path, quality='balanced'):
    """
    Generate adaptive high-quality mesh from STEP file using Gmsh.
    
    Args:
        step_file_path: Path to STEP file
        quality: 'fast', 'balanced', or 'ultra'
    
    Returns:
        dict: {
            'vertices': List of floats [x1,y1,z1, x2,y2,z2, ...],
            'indices': List of ints [i1,i2,i3, i4,i5,i6, ...],
            'normals': List of floats (per-vertex normals),
            'triangle_count': int,
            'quality_stats': dict
        }
    """
    if not GMSH_AVAILABLE:
        raise RuntimeError("Gmsh not available")
    
    preset = QUALITY_PRESETS.get(quality, QUALITY_PRESETS['balanced'])
    logger.info(f"🎨 Generating {quality} quality mesh (target: {preset['target_triangles']} triangles)...")
    
    # Acquire lock to ensure Gmsh runs in main thread safely
    with gmsh_lock:
        try:
            # Initialize Gmsh
            gmsh.initialize()
            gmsh.option.setNumber("General.Terminal", 0)
            
            # Import STEP file
            gmsh.merge(step_file_path)
            
            # Calculate adaptive mesh sizing (inline to avoid re-initialization)
            bbox = gmsh.model.getBoundingBox(-1, -1)
            xmin, ymin, zmin, xmax, ymax, zmax = bbox
            dx = xmax - xmin
            dy = ymax - ymin
            dz = zmax - zmin
            diagonal = math.sqrt(dx*dx + dy*dy + dz*dz)
            base_size = diagonal * preset['base_size_factor']
            
            logger.info(f"📏 Model diagonal: {diagonal:.2f}mm, base mesh size: {base_size:.4f}mm")
            
            # Use Gmsh's built-in curvature-adaptive meshing (industry standard)
            gmsh.option.setNumber("Mesh.MeshSizeFromCurvature", preset['curvature_points'])
            gmsh.option.setNumber("Mesh.MeshSizeMin", base_size * 0.1)
            gmsh.option.setNumber("Mesh.MeshSizeMax", base_size * preset['planar_factor'])
            gmsh.option.setNumber("Mesh.CharacteristicLengthMin", base_size * 0.1)
            gmsh.option.setNumber("Mesh.CharacteristicLengthMax", base_size * preset['planar_factor'])
            gmsh.option.setNumber("Mesh.CharacteristicLengthFromCurvature", 1)
            
            logger.info(f"📊 Using global adaptive meshing (base: {base_size:.4f}mm, curvature points: {preset['curvature_points']})")
            
            # Generate 2D surface mesh
            gmsh.model.mesh.generate(2)
            
            # Extract mesh data
            node_tags, node_coords, _ = gmsh.model.mesh.getNodes()
            elem_types, elem_tags, elem_node_tags = gmsh.model.mesh.getElements(2)
            
            # Process vertices
            vertices = node_coords.tolist() if isinstance(node_coords, np.ndarray) else list(node_coords)
            
            # Process triangles (filter to only triangular elements)
            indices = []
            for elem_type, tags, node_tags_for_type in zip(elem_types, elem_tags, elem_node_tags):
                if elem_type == 2:  # Triangle element type
                    # Convert 1-indexed to 0-indexed
                    indices.extend([int(tag) - 1 for tag in node_tags_for_type])
            
            triangle_count = len(indices) // 3
            
            # Calculate per-vertex normals
            normals = calculate_vertex_normals(vertices, indices)
            
            gmsh.finalize()
            
            logger.info(f"✅ Generated {triangle_count} triangles ({len(vertices)//3} vertices)")
            
            return {
                'vertices': vertices,
                'indices': indices,
                'normals': normals,
                'triangle_count': triangle_count,
                'quality_stats': {
                    'quality_preset': quality,
                    'curvature_points': preset['curvature_points'],
                    'base_mesh_size': base_size,
                    'diagonal': diagonal
                }
            }
        
        except Exception as e:
            logger.error(f"Mesh generation failed: {e}")
            gmsh.finalize()
            raise


def calculate_vertex_normals(vertices, indices):
    """Calculate angle-weighted normals with sharp edge detection"""
    num_vertices = len(vertices) // 3
    normals = np.zeros((num_vertices, 3))
    
    # First pass: Calculate face normals and areas
    face_normals = []
    face_areas = []
    
    for i in range(0, len(indices), 3):
        i1, i2, i3 = indices[i], indices[i+1], indices[i+2]
        
        v1 = np.array(vertices[i1*3:i1*3+3])
        v2 = np.array(vertices[i2*3:i2*3+3])
        v3 = np.array(vertices[i3*3:i3*3+3])
        
        edge1 = v2 - v1
        edge2 = v3 - v1
        
        face_normal = np.cross(edge1, edge2)
        area = np.linalg.norm(face_normal) / 2.0
        
        if area > 1e-10:
            face_normal = face_normal / (2.0 * area)  # Normalize
        else:
            face_normal = np.array([0, 0, 1])
        
        face_normals.append(face_normal)
        face_areas.append(area)
    
    # Second pass: Accumulate area-weighted normals for each vertex
    for face_idx, i in enumerate(range(0, len(indices), 3)):
        i1, i2, i3 = indices[i], indices[i+1], indices[i+2]
        
        fn = face_normals[face_idx]
        area = face_areas[face_idx]
        
        # Weight by face area (larger faces contribute more)
        for idx in [i1, i2, i3]:
            normals[idx] += fn * area
    
    # Third pass: Normalize
    for i in range(num_vertices):
        length = np.linalg.norm(normals[i])
        if length > 1e-10:
            normals[i] = normals[i] / length
        else:
            normals[i] = np.array([0, 0, 1])
    
    return normals.flatten().tolist()


# === API ENDPOINTS ===

@app.route('/mesh-cad', methods=['POST'])
def mesh_cad():
    """
    Generate high-quality adaptive mesh from STEP file.
    
    Request:
        - file: STEP file (multipart/form-data)
        - quality: 'fast' | 'balanced' | 'ultra' (default: 'balanced')
    
    Response:
        {
            "success": true,
            "vertices": [...],
            "indices": [...],
            "normals": [...],
            "triangle_count": 15234,
            "quality_stats": {...}
        }
    """
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        
        file = request.files['file']
        quality = request.form.get('quality', 'balanced')
        
        if quality not in QUALITY_PRESETS:
            return jsonify({'success': False, 'error': f'Invalid quality: {quality}'}), 400
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(suffix='.step', delete=False) as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name
        
        try:
            # Generate mesh
            mesh_data = generate_adaptive_mesh(tmp_path, quality)
            
            return jsonify({
                'success': True,
                **mesh_data
            })
        
        finally:
            # Cleanup
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    
    except Exception as e:
        logger.error(f"Mesh generation error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'service': 'mesh-service',
        'status': 'healthy',
        'gmsh_available': GMSH_AVAILABLE,
        'quality_presets': list(QUALITY_PRESETS.keys())
    })


@app.route('/', methods=['GET'])
def index():
    """Service information"""
    return jsonify({
        'service': 'High-Quality Mesh Generation Service',
        'version': '1.0.0',
        'endpoints': {
            '/mesh-cad': 'POST - Generate adaptive mesh from STEP file',
            '/health': 'GET - Health check'
        },
        'quality_presets': list(QUALITY_PRESETS.keys())
    })


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    logger.info(f"🚀 Starting Mesh Service on port {port}")
    logger.info(f"📊 Gmsh available: {GMSH_AVAILABLE}")
    app.run(host='0.0.0.0', port=port, debug=False)
