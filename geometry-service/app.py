"""
CAD Geometry Analysis Microservice
Parses STEP/IGES files using pythonOCC to extract real geometry data
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import tempfile
import os
import logging

# OCC imports for STEP parsing
from OCC.Core.STEPControl import STEPControl_Reader
from OCC.Core.BRepGProp import brepgprop
from OCC.Core.GProp import GProp_GProps
from OCC.Core.BRepBndLib import brepbndlib
from OCC.Core.Bnd import Bnd_Box
from OCC.Core.BRepAdaptor import BRepAdaptor_Surface
from OCC.Core.GeomAbs import GeomAbs_Cylinder, GeomAbs_Plane
from OCC.Core.TopExp import TopExp_Explorer
from OCC.Core.TopAbs import TopAbs_FACE

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'cad-geometry-analyzer'}), 200

@app.route('/analyze-cad', methods=['POST'])
def analyze_cad():
    """
    Analyze STEP/IGES file geometry
    
    Accepts: multipart/form-data with 'file' field
    Returns: JSON with geometry properties and detected features
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400
    
    logger.info(f"Analyzing file: {file.filename}")
    
    # Save temporarily
    file_ext = os.path.splitext(file.filename)[1].lower()
    with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp:
        file.save(tmp.name)
        tmp_path = tmp.name
    
    try:
        # Parse STEP file
        reader = STEPControl_Reader()
        status = reader.ReadFile(tmp_path)
        
        if status != 1:  # IFSelect_RetDone
            raise Exception(f"Failed to read STEP file, status: {status}")
        
        reader.TransferRoots()
        shape = reader.OneShape()
        
        if shape.IsNull():
            raise Exception("Failed to extract shape from STEP file")
        
        # Calculate volume
        props = GProp_GProps()
        brepgprop.VolumeProperties(shape, props)
        volume_mm3 = props.Mass()
        
        # Calculate surface area
        brepgprop.SurfaceProperties(shape, props)
        surface_area_mm2 = props.Mass()
        
        # Get bounding box
        bbox = Bnd_Box()
        brepbndlib.Add(shape, bbox)
        xmin, ymin, zmin, xmax, ymax, zmax = bbox.Get()
        
        width_mm = xmax - xmin
        height_mm = ymax - ymin
        depth_mm = zmax - zmin
        
        # Analyze faces for feature detection
        cylindrical_faces = 0
        planar_faces = 0
        total_faces = 0
        
        explorer = TopExp_Explorer(shape, TopAbs_FACE)
        while explorer.More():
            face = explorer.Current()
            surface = BRepAdaptor_Surface(face)
            surface_type = surface.GetType()
            
            if surface_type == GeomAbs_Cylinder:
                cylindrical_faces += 1
            elif surface_type == GeomAbs_Plane:
                planar_faces += 1
            
            total_faces += 1
            explorer.Next()
        
        logger.info(f"Geometry analysis: {total_faces} faces ({cylindrical_faces} cylindrical, {planar_faces} planar)")
        
        # Determine if cylindrical (>40% cylindrical faces)
        is_cylindrical = cylindrical_faces > (total_faces * 0.4) if total_faces > 0 else False
        has_flat_surfaces = planar_faces > 2
        
        # Complexity scoring based on face count
        complexity = min(10, max(1, int(total_faces / 10) + 3))
        
        result = {
            'volume_cm3': round(volume_mm3 / 1000, 2),
            'surface_area_cm2': round(surface_area_mm2 / 100, 2),
            'part_width_cm': round(width_mm / 10, 2),
            'part_height_cm': round(height_mm / 10, 2),
            'part_depth_cm': round(depth_mm / 10, 2),
            'complexity_score': complexity,
            'is_cylindrical': is_cylindrical,
            'has_flat_surfaces': has_flat_surfaces,
            'cylindrical_faces': cylindrical_faces,
            'planar_faces': planar_faces,
            'total_faces': total_faces,
            'confidence': 0.95,
            'method': 'pythonOCC_geometry_parsing'
        }
        
        logger.info(f"Analysis complete: cylindrical={is_cylindrical}, complexity={complexity}")
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error analyzing file: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500
        
    finally:
        # Clean up temp file
        try:
            os.unlink(tmp_path)
        except:
            pass

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
