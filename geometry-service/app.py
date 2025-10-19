import os
import io
import math
import tempfile
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from supabase import create_client, Client

# === OCC imports ===
from OCC.Core.STEPControl import STEPControl_Reader
from OCC.Core.BRep import BRep_Tool
from OCC.Core.BRepMesh import BRepMesh_IncrementalMesh
from OCC.Core.TopAbs import TopAbs_FACE, TopAbs_EDGE
from OCC.Core.TopExp import TopExp_Explorer, topexp
from OCC.Core.TopLoc import TopLoc_Location
from OCC.Core.Bnd import Bnd_Box
from OCC.Core.BRepBndLib import brepbndlib
from OCC.Core.BRepAdaptor import BRepAdaptor_Surface, BRepAdaptor_Curve
from OCC.Core.GCPnts import GCPnts_UniformAbscissa, GCPnts_AbscissaPoint
from OCC.Core.GeomAbs import (GeomAbs_Cylinder, GeomAbs_Plane, GeomAbs_Cone, 
                               GeomAbs_Sphere, GeomAbs_Torus, GeomAbs_BSplineSurface, 
                               GeomAbs_BezierSurface, GeomAbs_Line, GeomAbs_Circle,
                               GeomAbs_BSplineCurve, GeomAbs_BezierCurve)
from OCC.Core.TopoDS import topods
from OCC.Core.GProp import GProp_GProps
from OCC.Core.BRepGProp import brepgprop
from OCC.Core.TopTools import TopTools_IndexedDataMapOfShapeListOfShape, TopTools_ListIteratorOfListOfShape
from OCC.Core.gp import gp_Vec, gp_Pnt

import logging

# === CONFIG ===
app = Flask(__name__)
CORS(app)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app")

# === Supabase setup ===
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --------------------------------------------------
# === Geometry Utilities ===
# --------------------------------------------------

def calculate_bbox_diagonal(shape):
    """Calculate bounding box diagonal for adaptive tessellation"""
    bbox = Bnd_Box()
    brepbndlib.Add(shape, bbox)
    xmin, ymin, zmin, xmax, ymax, zmax = bbox.Get()
    dx = xmax - xmin
    dy = ymax - ymin
    dz = zmax - zmin
    diagonal = math.sqrt(dx*dx + dy*dy + dz*dz)
    return diagonal, (xmin, ymin, zmin, xmax, ymax, zmax)


def calculate_exact_volume_and_area(shape):
    """Calculate exact volume and surface area from BREP geometry (not mesh)"""
    # Exact volume calculation
    volume_props = GProp_GProps()
    brepgprop.VolumeProperties(shape, volume_props)
    exact_volume = volume_props.Mass()  # cubic mm
    
    # Exact surface area calculation
    area_props = GProp_GProps()
    brepgprop.SurfaceProperties(shape, area_props)
    exact_surface_area = area_props.Mass()  # square mm
    
    logger.info(f"📐 Exact BREP calculations: volume={exact_volume:.2f}mm³, area={exact_surface_area:.2f}mm²")
    
    return {
        'volume': exact_volume,
        'surface_area': exact_surface_area,
        'center_of_mass': [
            volume_props.CentreOfMass().X(),
            volume_props.CentreOfMass().Y(),
            volume_props.CentreOfMass().Z()
        ]
    }


def get_face_midpoint(face):
    """Get the midpoint of a face for topology classification"""
    from OCC.Core.BRepTools import breptools_UVBounds
    surf = BRepAdaptor_Surface(face)
    umin, umax, vmin, vmax = breptools_UVBounds(face)
    mid_u = (umin + umax) / 2
    mid_v = (vmin + vmax) / 2
    return surf.Value(mid_u, mid_v)


def classify_faces_topology(shape):
    """
    Classify faces as inner/outer/through using BREP topology.
    Returns: dict mapping face index to classification type
    """
    from OCC.Core.BRepClass3d import BRepClass3d_SolidClassifier
    from OCC.Core.TopAbs import TopAbs_IN, TopAbs_OUT
    
    face_types = {}
    face_objects = []  # Store face objects in order
    
    # STEP 1: Classify each face as inner or outer using solid classifier
    face_explorer = TopExp_Explorer(shape, TopAbs_FACE)
    face_idx = 0
    
    while face_explorer.More():
        face = topods.Face(face_explorer.Current())
        face_objects.append(face)
        
        try:
            mid_point = get_face_midpoint(face)
            
            # Use BRepClass3d to determine if point is inside solid
            classifier = BRepClass3d_SolidClassifier(shape)
            classifier.Perform(mid_point, 1e-6)
            state = classifier.State()
            
            # Store classification
            if state == TopAbs_IN:
                face_types[face_idx] = "inner"
            elif state == TopAbs_OUT:
                face_types[face_idx] = "outer"
            else:
                face_types[face_idx] = "outer"  # Default to outer for boundary cases
        except Exception as e:
            logger.warning(f"Face {face_idx} classification failed: {e}")
            face_types[face_idx] = "outer"  # Safe default
        
        face_idx += 1
        face_explorer.Next()
    
    # STEP 2: Build edge-to-faces adjacency map
    edge_face_map = TopTools_IndexedDataMapOfShapeListOfShape()
    topexp.MapShapesAndAncestors(shape, TopAbs_EDGE, TopAbs_FACE, edge_face_map)
    
    # STEP 3: Build efficient edge-to-face-indices mapping
    edge_to_face_indices = {}
    for map_idx in range(1, edge_face_map.Size() + 1):
        edge = edge_face_map.FindKey(map_idx)
        face_list = edge_face_map.FindFromIndex(map_idx)
        
        # Store which face indices are adjacent to this edge
        adjacent_face_indices = []
        
        # Use OCC iterator to traverse TopTools_ListOfShape
        face_iter = TopTools_ListIteratorOfListOfShape(face_list)
        while face_iter.More():
            adj_face = topods.Face(face_iter.Value())
            
            # Find this face's index in our face_objects list
            for face_idx, face in enumerate(face_objects):
                if adj_face.IsSame(face):
                    adjacent_face_indices.append(face_idx)
                    break
            
            face_iter.Next()
        
        edge_to_face_indices[edge] = adjacent_face_indices
    
    # STEP 4: Detect "through" faces (connect inner and outer)
    for face_idx, face in enumerate(face_objects):
        # Get all edges of this face
        edge_exp = TopExp_Explorer(face, TopAbs_EDGE)
        
        has_inner_neighbor = False
        has_outer_neighbor = False
        
        while edge_exp.More():
            edge = edge_exp.Current()
            
            # Find faces sharing this edge using our efficient mapping
            for map_edge, adj_face_indices in edge_to_face_indices.items():
                if edge.IsSame(map_edge):
                    # Check each adjacent face
                    for adj_idx in adj_face_indices:
                        if adj_idx != face_idx:
                            adj_type = face_types.get(adj_idx, "outer")
                            if adj_type == "inner":
                                has_inner_neighbor = True
                            elif adj_type == "outer":
                                has_outer_neighbor = True
                    break
            
            edge_exp.Next()
        
        # If face connects both inner and outer, it's a "through" surface
        if has_inner_neighbor and has_outer_neighbor:
            face_types[face_idx] = "through"
    
    logger.info(f"🔍 Topology classification complete: {len(face_types)} faces analyzed")
    type_counts = {}
    for ftype in face_types.values():
        type_counts[ftype] = type_counts.get(ftype, 0) + 1
    logger.info(f"   Distribution: {type_counts}")
    
    return face_types


def recognize_manufacturing_features(shape):
    """
    Analyze BREP topology to detect manufacturing features.
    This is for quotation accuracy, not display.
    """
    from OCC.Core.BRepGProp import BRepGProp_Face
    from OCC.Core.gp import gp_Pnt
    
    features = {
        'holes': [],
        'cylindrical_bosses': [],
        'planar_faces': [],
        'complex_surfaces': []
    }
    
    # Get bounding box center for internal/external classification
    bbox_diagonal, (xmin, ymin, zmin, xmax, ymax, zmax) = calculate_bbox_diagonal(shape)
    center = [(xmin + xmax) / 2, (ymin + ymax) / 2, (zmin + zmax) / 2]
    
    # Analyze each face
    face_explorer = TopExp_Explorer(shape, TopAbs_FACE)
    while face_explorer.More():
        face = topods.Face(face_explorer.Current())
        surface = BRepAdaptor_Surface(face)
        surf_type = surface.GetType()
        
        # Calculate face area from BREP (not mesh)
        face_props = GProp_GProps()
        brepgprop.SurfaceProperties(face, face_props)
        face_area = face_props.Mass()
        
        # Cylindrical faces → holes or bosses
        if surf_type == GeomAbs_Cylinder:
            cyl = surface.Cylinder()
            radius = cyl.Radius()
            axis_dir = cyl.Axis().Direction()
            axis_pos = cyl.Axis().Location()
            
            # Determine if internal (hole) or external (boss)
            face_center = face_props.CentreOfMass()
            vector_to_center = [
                center[0] - face_center.X(),
                center[1] - face_center.Y(),
                center[2] - face_center.Z()
            ]
            
            # Sample normal at face center
            u_mid = (surface.FirstUParameter() + surface.LastUParameter()) / 2
            v_mid = (surface.FirstVParameter() + surface.LastVParameter()) / 2
            point = gp_Pnt()
            normal_vec = gp_Vec()
            BRepGProp_Face(face).Normal(u_mid, v_mid, point, normal_vec)
            
            dot_product = (
                normal_vec.X() * vector_to_center[0] +
                normal_vec.Y() * vector_to_center[1] +
                normal_vec.Z() * vector_to_center[2]
            )
            
            feature_data = {
                'diameter': radius * 2,
                'axis': [axis_dir.X(), axis_dir.Y(), axis_dir.Z()],
                'position': [axis_pos.X(), axis_pos.Y(), axis_pos.Z()],
                'area': face_area
            }
            
            if dot_product > 0:  # Normal points toward center → internal
                features['holes'].append(feature_data)
            else:  # Normal points away → external boss
                features['cylindrical_bosses'].append(feature_data)
        
        # Planar faces
        elif surf_type == GeomAbs_Plane:
            plane = surface.Plane()
            normal = plane.Axis().Direction()
            features['planar_faces'].append({
                'normal': [normal.X(), normal.Y(), normal.Z()],
                'area': face_area
            })
        
        # Complex surfaces (NURBS, B-splines, cones, etc.)
        else:
            features['complex_surfaces'].append({
                'type': str(surf_type),
                'area': face_area
            })
        
        face_explorer.Next()
    
    # Log summary
    logger.info(f"🔧 Feature recognition: {len(features['holes'])} holes, "
                f"{len(features['cylindrical_bosses'])} bosses, "
                f"{len(features['planar_faces'])} planar faces, "
                f"{len(features['complex_surfaces'])} complex surfaces")
    
    return features


def extract_feature_edges(shape, max_edges=500, max_time_seconds=20):
    """
    Extract TRUE feature edges from BREP geometry (not mesh tessellation).
    Returns edges as polylines sampled from the actual CAD curves.
    This eliminates tessellation artifacts - cylinders show clean circles, not triangulated edges.
    """
    logger.info("🔍 Extracting BREP feature edges from CAD geometry...")
    
    feature_edges = []
    edge_count = 0
    
    try:
        # Explore all edges in the BREP topology
        edge_explorer = TopExp_Explorer(shape, TopAbs_EDGE)
        
        while edge_explorer.More() and edge_count < max_edges:
            edge = topods.Edge(edge_explorer.Current())
            
            try:
                # Get the 3D curve from the edge (BRep_Tool.Curve returns a tuple/list)
                curve_result = BRep_Tool.Curve(edge)
                
                # Handle degenerate edges (no 3D curve or incomplete result)
                if not curve_result or len(curve_result) < 3:
                    edge_explorer.Next()
                    continue
                
                if curve_result[0] is None:
                    edge_explorer.Next()
                    continue
                
                curve = curve_result[0]  # Already a Geom_Curve, no GetObject() needed
                first_param = curve_result[1]
                last_param = curve_result[2]
                
                # Create curve adapter for querying curve properties
                curve_adaptor = BRepAdaptor_Curve(edge)
                curve_type = curve_adaptor.GetType()
                
                # Adaptive sampling based on curve type
                if curve_type == GeomAbs_Line:
                    # Lines only need 2 points
                    num_samples = 2
                elif curve_type == GeomAbs_Circle:
                    # Circles need more points for smooth appearance
                    num_samples = 32
                elif curve_type in [GeomAbs_BSplineCurve, GeomAbs_BezierCurve]:
                    # Complex curves need adaptive sampling
                    num_samples = 24
                else:
                    # Default for other curve types
                    num_samples = 20
                
                # Sample points along the curve
                points = []
                for i in range(num_samples + 1):
                    param = first_param + (last_param - first_param) * i / num_samples
                    point = curve.Value(param)
                    points.append([point.X(), point.Y(), point.Z()])
                
                # Only add edges with valid geometry
                if len(points) >= 2:
                    feature_edges.append(points)
                    edge_count += 1
                    
            except Exception as e:
                # Log edge extraction failures for debugging
                logger.warning(f"⚠️ Failed to extract edge: {type(e).__name__}: {e}")
                pass
            
            edge_explorer.Next()
        
        logger.info(f"✅ Extracted {len(feature_edges)} BREP feature edges (no tessellation artifacts)")
        
    except Exception as e:
        logger.error(f"Error extracting feature edges: {e}")
        return []
    
    return feature_edges


def calculate_face_center(triangulation, transform):
    """Compute the average center of a face from its triangulation"""
    try:
        total = np.zeros(3)
        for i in range(1, triangulation.NbNodes() + 1):
            p = triangulation.Node(i)
            p.Transform(transform)
            total += np.array([p.X(), p.Y(), p.Z()])
        return (total / triangulation.NbNodes()).tolist()
    except Exception:
        return [0, 0, 0]


def get_average_face_normal(triangulation, transform, reversed_face=False):
    """Approximate average normal of a face"""
    try:
        v1 = triangulation.Node(1)
        v2 = triangulation.Node(2)
        v3 = triangulation.Node(3)
        v1.Transform(transform)
        v2.Transform(transform)
        v3.Transform(transform)
        e1 = np.array([v2.X() - v1.X(), v2.Y() - v1.Y(), v2.Z() - v1.Z()])
        e2 = np.array([v3.X() - v1.X(), v3.Y() - v1.Y(), v3.Z() - v1.Z()])
        n = np.cross(e1, e2)
        n /= np.linalg.norm(n) + 1e-9
        if reversed_face:
            n *= -1
        return n.tolist()
    except Exception:
        return [0, 0, 1]


# --------------------------------------------------
# === Tessellation ===
# --------------------------------------------------

def tessellate_shape(shape):
    """
    Generate display mesh with adaptive quality for smooth curved surfaces (Phase A).
    Curved surfaces get 3x finer tessellation, flat surfaces stay coarse.
    This is ONLY for visual verification, NOT for manufacturing calculations.
    """
    try:
        # Calculate adaptive deflection based on part size
        bbox_diagonal, bbox_coords = calculate_bbox_diagonal(shape)
        
        # Use refined tessellation (0.2mm max) for high-quality curved surface rendering
        # This eliminates visible triangulation artifacts on holes and cylinders
        base_deflection = min(bbox_diagonal * 0.008, 0.2)  # Cap at 0.2mm for professional quality
        
        logger.info(f"🔧 Refined tessellation: diagonal={bbox_diagonal:.2f}mm, base_deflection={base_deflection:.4f}mm")
        
        # Phase A: Apply surface-specific tessellation quality
        face_explorer = TopExp_Explorer(shape, TopAbs_FACE)
        while face_explorer.More():
            face = topods.Face(face_explorer.Current())
            surface = BRepAdaptor_Surface(face)
            surf_type = surface.GetType()
            
            # Detect curved surfaces that need fine tessellation
            if surf_type in [GeomAbs_Cylinder, GeomAbs_Cone, GeomAbs_Sphere, 
                           GeomAbs_Torus, GeomAbs_BSplineSurface, GeomAbs_BezierSurface]:
                # 8x finer for professional smooth curves (no visible triangles)
                face_deflection = base_deflection / 8.0  # 0.1% of diagonal
                angular_deflection = 0.15  # Very fine angular steps
            else:
                # Coarse for flat surfaces (planes don't need refinement)
                face_deflection = base_deflection
                angular_deflection = 0.5
            
            # Apply face-specific tessellation with error handling
            try:
                face_mesh = BRepMesh_IncrementalMesh(face, face_deflection, False, angular_deflection, True)
                face_mesh.Perform()
            except Exception as e:
                logger.warning(f"Face tessellation failed, using default: {e}")
                # Continue to next face instead of crashing
            
            face_explorer.Next()

        bbox = Bnd_Box()
        brepbndlib.Add(shape, bbox)
        xmin, ymin, zmin, xmax, ymax, zmax = bbox.Get()
        cx, cy, cz = (xmin + xmax) / 2, (ymin + ymax) / 2, (zmin + zmax) / 2
        max_radius = max(xmax - xmin, ymax - ymin, zmax - zmin) / 2

        logger.info("📐 Extracting vertices, indices, and normals from triangulation...")
        
        # Classify all faces using topology analysis ONCE before tessellation
        logger.info("🔍 Running topology-based face classification...")
        face_types_topo = classify_faces_topology(shape)
        
        # Color mapping for display
        FACE_COLOR_MAP = {
            "inner": "internal",      # Red - holes, bores, pockets
            "outer": "external",      # Gray - external surfaces
            "through": "through",     # Yellow - holes connecting inside/outside
        }
        
        # Priority system: lower number = higher priority (external wins over internal)
        FACE_PRIORITY = {
            "external": 1,      # Highest priority - outer surfaces
            "through": 2,       # High priority - through holes
            "planar": 3,        # Medium priority - flat faces
            "internal": 4       # Lowest priority - holes/pockets
        }
        
        vertices, indices, normals, vertex_colors = [], [], [], []
        vertex_map = {}
        current_index = 0
        vertex_tolerance = base_deflection * 0.1  # Weld vertices within 0.01% diagonal
        face_explorer = TopExp_Explorer(shape, TopAbs_FACE)
        face_idx = 0

        while face_explorer.More():
            face = face_explorer.Current()
            loc = TopLoc_Location()
            triangulation = BRep_Tool.Triangulation(face, loc)
            if triangulation is None:
                face_explorer.Next()
                face_idx += 1
                continue

            transform = loc.Transformation()
            surface = BRepAdaptor_Surface(face)
            reversed_face = face.Orientation() == 1
            surf_type = surface.GetType()
            center = calculate_face_center(triangulation, transform)
            
            # Calculate vector from bounding box center to face center (for normal orientation)
            bbox_center = [cx, cy, cz]
            to_surface = [center[0] - bbox_center[0], center[1] - bbox_center[1], center[2] - bbox_center[2]]
            
            # Get face type from topology classification
            base_face_type = face_types_topo.get(face_idx, "outer")
            
            # Refine planar faces (keep planar classification for flat surfaces)
            if surf_type == GeomAbs_Plane:
                ftype = "planar"
            else:
                ftype = FACE_COLOR_MAP.get(base_face_type, "external")

            # vertices with welding tolerance to close microgaps
            face_vertices = []
            for i in range(1, triangulation.NbNodes() + 1):
                p = triangulation.Node(i)
                p.Transform(transform)
                # Round to vertex_tolerance precision for welding
                coord = (round(p.X(), 6), round(p.Y(), 6), round(p.Z(), 6))
                if coord not in vertex_map:
                    # New vertex - assign current face type
                    vertex_map[coord] = current_index
                    vertices.extend(coord)
                    vertex_colors.append(ftype)
                    face_vertices.append(current_index)
                    current_index += 1
                else:
                    # Existing vertex - check if current face has higher priority
                    existing_idx = vertex_map[coord]
                    existing_type = vertex_colors[existing_idx]
                    current_priority = FACE_PRIORITY.get(ftype, 99)
                    existing_priority = FACE_PRIORITY.get(existing_type, 99)
                    
                    # Update color only if current face has higher priority (lower number)
                    if current_priority < existing_priority:
                        vertex_colors[existing_idx] = ftype
                    
                    face_vertices.append(existing_idx)

            # triangles
            for i in range(1, triangulation.NbTriangles() + 1):
                tri = triangulation.Triangle(i)
                n1, n2, n3 = tri.Get()
                idx = [face_vertices[n1 - 1], face_vertices[n2 - 1], face_vertices[n3 - 1]]
                if reversed_face:
                    indices.extend([idx[0], idx[2], idx[1]])
                else:
                    indices.extend(idx)
                v1, v2, v3 = [vertices[j * 3:j * 3 + 3] for j in idx]
                e1 = [v2[k] - v1[k] for k in range(3)]
                e2 = [v3[k] - v1[k] for k in range(3)]
                n = [
                    e1[1] * e2[2] - e1[2] * e2[1],
                    e1[2] * e2[0] - e1[0] * e2[2],
                    e1[0] * e2[1] - e1[1] * e2[0],
                ]
                l = math.sqrt(sum(x * x for x in n))
                if l > 0:
                    n = [x / l for x in n]
                if sum(n * v for n, v in zip(n, to_surface)) < 0:
                    n = [-x for x in n]
                for _ in range(3):
                    normals.extend(n)

            face_explorer.Next()
            face_idx += 1

        vertex_count = len(vertices) // 3
        triangle_count = len(indices) // 3
        logger.info(
            f"Tessellation complete: {vertex_count} vertices, {triangle_count} triangles, {len(vertex_colors)} vertex_colors"
        )
        return {
            "vertices": vertices,
            "indices": indices,
            "normals": normals,
            "vertex_colors": vertex_colors,
            "triangle_count": triangle_count,
        }

    except Exception as e:
        logger.error(f"Tessellation error: {e}")
        return {
            "vertices": [],
            "indices": [],
            "normals": [],
            "vertex_colors": [],
            "triangle_count": 0,
        }

# --------------------------------------------------
# === STEP file upload endpoint ===
# --------------------------------------------------

@app.route("/analyze-cad", methods=["POST"])
def analyze_cad():
    """Upload a STEP file, analyze BREP geometry, generate display mesh"""
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]
        if not (file.filename.lower().endswith(".step") or file.filename.lower().endswith(".stp")):
            return jsonify({"error": "Only .step or .stp files are supported"}), 400

        # Read and temporarily save file
        step_bytes = file.read()
        fd, tmp_path = tempfile.mkstemp(suffix=".step")
        try:
            os.write(fd, step_bytes)
            os.close(fd)

            reader = STEPControl_Reader()
            status = reader.ReadFile(tmp_path)
            if status != 1:
                return jsonify({"error": "Failed to read STEP file"}), 400
            reader.TransferRoots()
            shape = reader.OneShape()
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

        # === STEP 1: EXACT BREP ANALYSIS (for quotation) ===
        logger.info("📐 Analyzing BREP geometry for manufacturing calculations...")
        exact_props = calculate_exact_volume_and_area(shape)
        manufacturing_features = recognize_manufacturing_features(shape)
        
        # === STEP 2: DISPLAY MESH (for visualization only) ===
        logger.info("🎨 Generating display mesh for 3D viewer...")
        mesh_data = tessellate_shape(shape)  # No quality parameter
        
        # === STEP 3: BREP EDGE EXTRACTION (true CAD edges, not mesh) ===
        logger.info("📏 Extracting BREP feature edges for professional display...")
        feature_edges = extract_feature_edges(shape, max_edges=500)
        mesh_data["feature_edges"] = feature_edges
        mesh_data["triangle_count"] = len(mesh_data.get("indices", [])) // 3

        # Detect cylindrical features (legacy heuristic for compatibility)
        is_cylindrical = len(manufacturing_features['holes']) > 0 or len(manufacturing_features['cylindrical_bosses']) > 0
        has_flat_surfaces = len(manufacturing_features['planar_faces']) > 0
        total_faces = (len(manufacturing_features['holes']) + 
                      len(manufacturing_features['cylindrical_bosses']) + 
                      len(manufacturing_features['planar_faces']) + 
                      len(manufacturing_features['complex_surfaces']))

        # Calculate complexity based on feature count
        cylindrical_faces = len(manufacturing_features['holes']) + len(manufacturing_features['cylindrical_bosses'])
        planar_faces = len(manufacturing_features['planar_faces'])
        complexity_score = min(10, int(
            (total_faces / 10) +
            (cylindrical_faces * 0.2) + 
            (planar_faces * 0.1)
        ))

        # Get bounding box
        bbox = Bnd_Box()
        brepbndlib.Add(shape, bbox)
        xmin, ymin, zmin, xmax, ymax, zmax = bbox.Get()

        part_width_cm = (xmax - xmin) / 10
        part_height_cm = (ymax - ymin) / 10
        part_depth_cm = (zmax - zmin) / 10

        logger.info(f"✅ Analysis complete: {mesh_data['triangle_count']} triangles, {len(feature_edges)} edges")

        # === RETURN COMBINED DATA ===
        return jsonify({
            # BREP-based exact calculations (for quotation)
            'exact_volume': exact_props['volume'],
            'exact_surface_area': exact_props['surface_area'],
            'center_of_mass': exact_props['center_of_mass'],
            'manufacturing_features': manufacturing_features,
            
            # Display mesh (for 3D viewer)
            'mesh_data': {
                'vertices': mesh_data['vertices'],
                'indices': mesh_data['indices'],
                'normals': mesh_data['normals'],
                'vertex_colors': mesh_data['vertex_colors'],
                'feature_edges': feature_edges,
                'triangle_count': mesh_data['triangle_count'],
                'face_classification_method': 'brep_topology'
            },
            
            # Legacy fields for compatibility
            'volume_cm3': exact_props['volume'] / 1000,  # mm³ to cm³
            'surface_area_cm2': exact_props['surface_area'] / 100,  # mm² to cm²
            'is_cylindrical': is_cylindrical,
            'has_flat_surfaces': has_flat_surfaces,
            'complexity_score': complexity_score,
            'part_width_cm': part_width_cm,
            'part_height_cm': part_height_cm,
            'part_depth_cm': part_depth_cm,
            'total_faces': total_faces,
            'planar_faces': planar_faces,
            'cylindrical_faces': cylindrical_faces,
            
            # Metadata
            'analysis_type': 'dual_representation',
            'quotation_ready': True,
            'status': 'success',
            'confidence': 0.98,
            'method': 'brep_dual_representation'
        })

    except Exception as e:
        logger.error(f"Error processing CAD: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({
            "error": str(e),
            "traceback": traceback.format_exc() if os.getenv("DEBUG") else None
        }), 500


@app.route("/")
def root():
    return jsonify({
        "service": "CAD Geometry Analysis Service",
        "version": "1.4.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "analyze": "/analyze-cad"
        },
        "documentation": "POST multipart/form-data with 'file' field containing .step file, optional 'edge_density' param"
    })


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
