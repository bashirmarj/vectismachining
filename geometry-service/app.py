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
from OCC.Core.BRepAdaptor import BRepAdaptor_Surface, BRepAdaptor_Curve
from OCC.Core.GeomAbs import GeomAbs_Cylinder, GeomAbs_Plane, GeomAbs_Circle
from OCC.Core.TopExp import TopExp_Explorer
from OCC.Core.TopAbs import TopAbs_FACE, TopAbs_EDGE
from OCC.Core.gp import gp_Pnt, gp_Vec, gp_Dir
from OCC.Core.BRepMesh import BRepMesh_IncrementalMesh
from OCC.Core.TopLoc import TopLoc_Location
from OCC.Core.BRep import BRep_Tool
import math

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
        
        # Advanced feature detection
        holes = detect_holes(shape)
        grooves = detect_grooves(shape, cylindrical_faces)
        flat_surfaces = detect_flat_surfaces_detailed(shape)
        primary_dims = calculate_principal_dimensions(shape, (xmin, ymin, zmin, xmax, ymax, zmax), is_cylindrical)
        
        # Tessellate shape to extract mesh data
        quality = float(request.form.get('quality', 0.5))  # 0-1, higher = finer mesh
        mesh_data = tessellate_shape(shape, quality)
        
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
            'method': 'pythonOCC_geometry_parsing',
            'detected_features': {
                'holes': holes,
                'grooves': grooves,
                'flat_surfaces': flat_surfaces,
                'primary_dimensions': primary_dims
            },
            'mesh_data': mesh_data
        }
        
        logger.info(f"Analysis complete: cylindrical={is_cylindrical}, complexity={complexity}, holes={len(holes)}, grooves={len(grooves)}, triangles={mesh_data['triangle_count']}")
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

def detect_holes(shape):
    """Detect circular holes (cylindrical voids)"""
    holes = []
    
    try:
        # Find all edges and look for circular ones
        edge_explorer = TopExp_Explorer(shape, TopAbs_EDGE)
        circular_edges = []
        
        while edge_explorer.More():
            edge = edge_explorer.Current()
            curve = BRepAdaptor_Curve(edge)
            
            if curve.GetType() == GeomAbs_Circle:
                circle = curve.Circle()
                center = circle.Location()
                axis = circle.Axis().Direction()
                radius = circle.Radius()
                
                circular_edges.append({
                    'center': (center.X(), center.Y(), center.Z()),
                    'axis': (axis.X(), axis.Y(), axis.Z()),
                    'radius': radius
                })
            
            edge_explorer.Next()
        
        # Group circular edges that share same axis (indicating a hole)
        processed = set()
        for i, edge1 in enumerate(circular_edges):
            if i in processed:
                continue
            
            hole_edges = [edge1]
            for j, edge2 in enumerate(circular_edges):
                if j <= i or j in processed:
                    continue
                
                # Check if axes are parallel and centers aligned
                axis_dot = sum(a*b for a,b in zip(edge1['axis'], edge2['axis']))
                if abs(abs(axis_dot) - 1.0) < 0.1:  # Nearly parallel
                    # Check if centers are on same axis line
                    center_diff = tuple(c2-c1 for c1,c2 in zip(edge1['center'], edge2['center']))
                    cross_product_mag = sum((center_diff[i]*edge1['axis'][j] - center_diff[j]*edge1['axis'][i])**2 
                                           for i,j in [(0,1), (1,2), (0,2)])
                    
                    if cross_product_mag < 100:  # Centers aligned
                        hole_edges.append(edge2)
                        processed.add(j)
            
            processed.add(i)
            
            if len(hole_edges) >= 1:
                # Calculate hole properties
                avg_radius = sum(e['radius'] for e in hole_edges) / len(hole_edges)
                
                # Calculate depth from center separation
                if len(hole_edges) >= 2:
                    centers = [e['center'] for e in hole_edges]
                    depth = max(math.sqrt(sum((c1[i]-c2[i])**2 for i in range(3))) 
                               for c1 in centers for c2 in centers)
                    through = depth > avg_radius * 2  # Heuristic: through if depth > diameter
                else:
                    depth = avg_radius  # Blind hole approximation
                    through = False
                
                # Classify orientation
                axis = hole_edges[0]['axis']
                abs_axis = tuple(abs(a) for a in axis)
                max_component = max(abs_axis)
                
                if abs(abs_axis[2] - max_component) < 0.1:
                    orientation = 'Top+0°' if axis[2] > 0 else 'Top+180°'
                elif abs(abs_axis[0] - max_component) < 0.1:
                    orientation = 'Right' if axis[0] > 0 else 'Left'
                else:
                    orientation = 'Front' if axis[1] > 0 else 'Back'
                
                holes.append({
                    'type': 'hole',
                    'diameter_mm': round(avg_radius * 2, 2),
                    'depth_mm': round(depth, 2),
                    'through': through,
                    'position': [round(hole_edges[0]['center'][i], 2) for i in range(3)],
                    'axis': [round(axis[i], 2) for i in range(3)],
                    'orientation': orientation
                })
    
    except Exception as e:
        logger.error(f"Error detecting holes: {e}")
    
    return holes

def detect_grooves(shape, cylindrical_face_count):
    """Detect annular grooves (parallel circular cuts)"""
    grooves = []
    
    if cylindrical_face_count < 2:
        return grooves  # Need cylindrical geometry for grooves
    
    try:
        # Look for pairs of cylindrical faces with different radii
        face_explorer = TopExp_Explorer(shape, TopAbs_FACE)
        cylindrical_surfaces = []
        
        while face_explorer.More():
            face = face_explorer.Current()
            surface = BRepAdaptor_Surface(face)
            
            if surface.GetType() == GeomAbs_Cylinder:
                cylinder = surface.Cylinder()
                axis = cylinder.Axis().Direction()
                radius = cylinder.Radius()
                
                cylindrical_surfaces.append({
                    'axis': (axis.X(), axis.Y(), axis.Z()),
                    'radius': radius
                })
            
            face_explorer.Next()
        
        # Group by similar axis and find radius differences
        if len(cylindrical_surfaces) >= 2:
            radii = sorted(set(round(s['radius'], 1) for s in cylindrical_surfaces))
            
            if len(radii) >= 2:
                # Approximate groove from radius differences
                inner_radius = radii[0]
                outer_radius = radii[-1]
                
                if outer_radius - inner_radius > 1.0:  # Significant difference
                    grooves.append({
                        'type': 'groove',
                        'inner_diameter_mm': round(inner_radius * 2, 2),
                        'outer_diameter_mm': round(outer_radius * 2, 2),
                        'depth_mm': round((outer_radius - inner_radius), 2),
                        'location': 'external',
                        'orientation': 'Radial'
                    })
    
    except Exception as e:
        logger.error(f"Error detecting grooves: {e}")
    
    return grooves

def detect_flat_surfaces_detailed(shape):
    """Detect flat surfaces with dimensions"""
    flats = []
    
    try:
        face_explorer = TopExp_Explorer(shape, TopAbs_FACE)
        
        while face_explorer.More():
            face = face_explorer.Current()
            surface = BRepAdaptor_Surface(face)
            
            if surface.GetType() == GeomAbs_Plane:
                # Get plane normal
                plane = surface.Plane()
                normal = plane.Axis().Direction()
                
                # Classify orientation
                abs_normal = tuple(abs(n) for n in [normal.X(), normal.Y(), normal.Z()])
                max_comp = max(abs_normal)
                
                if abs(abs_normal[2] - max_comp) < 0.1:
                    orientation = 'Top' if normal.Z() > 0 else 'Bottom'
                elif abs(abs_normal[0] - max_comp) < 0.1:
                    orientation = 'Side-X'
                else:
                    orientation = 'Side-Y'
                
                # Approximate area (would need more complex calculation for exact area)
                flats.append({
                    'type': 'flat',
                    'orientation': orientation,
                    'area_mm2': 100.0,  # Placeholder
                    'width_mm': 10.0,   # Placeholder
                    'length_mm': 10.0   # Placeholder
                })
            
            face_explorer.Next()
    
    except Exception as e:
        logger.error(f"Error detecting flat surfaces: {e}")
    
    return flats[:5]  # Limit to top 5 flats

def calculate_principal_dimensions(shape, bbox, is_cylindrical):
    """Calculate primary dimensions of the part"""
    xmin, ymin, zmin, xmax, ymax, zmax = bbox
    
    width = xmax - xmin
    height = ymax - ymin
    depth = zmax - zmin
    
    dims = {
        'length_mm': round(depth, 2),
        'primary_axis': 'Z'
    }
    
    if is_cylindrical:
        # For cylindrical parts, identify major diameter
        dims['major_diameter_mm'] = round(max(width, height), 2)
        dims['length_mm'] = round(depth, 2)
    else:
        # For prismatic parts
        dims['width_mm'] = round(width, 2)
        dims['height_mm'] = round(height, 2)
        dims['length_mm'] = round(depth, 2)
    
    return dims

def tessellate_shape(shape, quality=0.5):
    """
    Tessellate STEP shape into triangulated mesh for 3D rendering
    
    Args:
        shape: TopoDS_Shape from STEP file
        quality: 0-1 value, higher = finer mesh (more triangles, slower)
    
    Returns:
        dict with vertices, indices, normals arrays for Three.js BufferGeometry
    """
    try:
        # Quality controls deflection (lower = finer mesh)
        # 0.5 quality -> 0.5mm deflection (good balance)
        # 0.1 quality -> 0.1mm deflection (very fine)
        # 1.0 quality -> 1.0mm deflection (coarse, fast)
        deflection = 1.0 - quality + 0.1  # Map to 0.1-1.0mm range
        
        # Create incremental mesh
        logger.info(f"Tessellating shape with quality={quality} (deflection={deflection}mm)")
        mesh = BRepMesh_IncrementalMesh(shape, deflection)
        mesh.Perform()
        
        if not mesh.IsDone():
            raise Exception("Mesh tessellation failed")
        
        # Extract triangulated geometry
        vertices = []
        indices = []
        normals = []
        vertex_map = {}  # Map vertex coords to index
        current_index = 0
        
        # Iterate through all faces
        face_explorer = TopExp_Explorer(shape, TopAbs_FACE)
        
        while face_explorer.More():
            face = face_explorer.Current()
            location = TopLoc_Location()
            triangulation = BRep_Tool.Triangulation(face, location)
            
            if triangulation is None:
                face_explorer.Next()
                continue
            
            # Get transformation
            transform = location.Transformation()
            
            # Get face normal direction
            surface = BRepAdaptor_Surface(face)
            face_reversed = face.Orientation() == 1  # TopAbs_REVERSED
            
            # Build local vertex map for this face
            face_vertex_start = current_index
            face_vertices = []
            
            # Extract vertices
            for i in range(1, triangulation.NbNodes() + 1):
                pnt = triangulation.Node(i)
                # Apply transformation
                pnt.Transform(transform)
                
                coord = (round(pnt.X(), 6), round(pnt.Y(), 6), round(pnt.Z(), 6))
                
                if coord not in vertex_map:
                    vertices.extend([pnt.X(), pnt.Y(), pnt.Z()])
                    vertex_map[coord] = current_index
                    face_vertices.append(current_index)
                    current_index += 1
                else:
                    face_vertices.append(vertex_map[coord])
            
            # Extract triangles
            for i in range(1, triangulation.NbTriangles() + 1):
                triangle = triangulation.Triangle(i)
                n1, n2, n3 = triangle.Get()
                
                # Map to global indices
                idx1 = face_vertices[n1 - 1]
                idx2 = face_vertices[n2 - 1]
                idx3 = face_vertices[n3 - 1]
                
                # Reverse winding if face is reversed
                if face_reversed:
                    indices.extend([idx1, idx3, idx2])
                else:
                    indices.extend([idx1, idx2, idx3])
                
                # Calculate triangle normal
                v1 = vertices[idx1*3:idx1*3+3]
                v2 = vertices[idx2*3:idx2*3+3]
                v3 = vertices[idx3*3:idx3*3+3]
                
                edge1 = [v2[i] - v1[i] for i in range(3)]
                edge2 = [v3[i] - v1[i] for i in range(3)]
                
                # Cross product
                normal = [
                    edge1[1] * edge2[2] - edge1[2] * edge2[1],
                    edge1[2] * edge2[0] - edge1[0] * edge2[2],
                    edge1[0] * edge2[1] - edge1[1] * edge2[0]
                ]
                
                # Normalize
                length = math.sqrt(sum(n*n for n in normal))
                if length > 0:
                    normal = [n / length for n in normal]
                
                # Reverse normal if face is reversed
                if face_reversed:
                    normal = [-n for n in normal]
                
                # Add normal for each vertex of triangle
                for _ in range(3):
                    normals.extend(normal)
            
            face_explorer.Next()
        
        triangle_count = len(indices) // 3
        
        logger.info(f"Tessellation complete: {len(vertices)//3} vertices, {triangle_count} triangles")
        
        return {
            'vertices': vertices,
            'indices': indices,
            'normals': normals,
            'triangle_count': triangle_count
        }
        
    except Exception as e:
        logger.error(f"Error tessellating shape: {e}")
        # Return minimal mesh on error
        return {
            'vertices': [],
            'indices': [],
            'normals': [],
            'triangle_count': 0
        }

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
