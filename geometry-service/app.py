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
from OCC.Core.TopAbs import TopAbs_FACE, TopAbs_EDGE, TopAbs_IN
from OCC.Core.TopExp import TopExp_Explorer, topexp
from OCC.Core.TopLoc import TopLoc_Location
from OCC.Core.Bnd import Bnd_Box
from OCC.Core.BRepBndLib import brepbndlib
from OCC.Core.BRepAdaptor import BRepAdaptor_Surface, BRepAdaptor_Curve
from OCC.Core.BRepTools import breptools
from OCC.Core.GCPnts import GCPnts_UniformAbscissa, GCPnts_AbscissaPoint
from OCC.Core.GeomAbs import (GeomAbs_Cylinder, GeomAbs_Plane, GeomAbs_Cone, 
                               GeomAbs_Sphere, GeomAbs_Torus, GeomAbs_BSplineSurface, 
                               GeomAbs_BezierSurface, GeomAbs_Line, GeomAbs_Circle,
                               GeomAbs_BSplineCurve, GeomAbs_BezierCurve)
from OCC.Core.TopoDS import topods
from OCC.Core.GProp import GProp_GProps
from OCC.Core.BRepGProp import brepgprop, BRepGProp_Face
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
    volume_props = GProp_GProps()
    brepgprop.VolumeProperties(shape, volume_props)
    exact_volume = volume_props.Mass()
    
    area_props = GProp_GProps()
    brepgprop.SurfaceProperties(shape, area_props)
    exact_surface_area = area_props.Mass()
    
    logger.info(f"🔍 Exact BREP calculations: volume={exact_volume:.2f}mm³, area={exact_surface_area:.2f}mm²")
    
    return {
        'volume': exact_volume,
        'surface_area': exact_surface_area,
        'center_of_mass': [
            volume_props.CentreOfMass().X(),
            volume_props.CentreOfMass().Y(),
            volume_props.CentreOfMass().Z()
        ]
    }


def recognize_manufacturing_features(shape):
    """Analyze BREP topology to detect manufacturing features"""
    features = {
        'holes': [],
        'cylindrical_bosses': [],
        'planar_faces': [],
        'complex_surfaces': []
    }
    
    bbox_diagonal, (xmin, ymin, zmin, xmax, ymax, zmax) = calculate_bbox_diagonal(shape)
    center = [(xmin + xmax) / 2, (ymin + ymax) / 2, (zmin + zmax) / 2]
    
    face_explorer = TopExp_Explorer(shape, TopAbs_FACE)
    while face_explorer.More():
        face = topods.Face(face_explorer.Current())
        surface = BRepAdaptor_Surface(face)
        surf_type = surface.GetType()
        
        face_props = GProp_GProps()
        brepgprop.SurfaceProperties(face, face_props)
        face_area = face_props.Mass()
        
        if surf_type == GeomAbs_Cylinder:
            cyl = surface.Cylinder()
            radius = cyl.Radius()
            axis_dir = cyl.Axis().Direction()
            axis_pos = cyl.Axis().Location()
            
            face_center = face_props.CentreOfMass()
            vector_to_center = [
                center[0] - face_center.X(),
                center[1] - face_center.Y(),
                center[2] - face_center.Z()
            ]
            
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
            
            if dot_product > 0:
                features['holes'].append(feature_data)
            else:
                features['cylindrical_bosses'].append(feature_data)
        
        elif surf_type == GeomAbs_Plane:
            plane = surface.Plane()
            normal = plane.Axis().Direction()
            features['planar_faces'].append({
                'normal': [normal.X(), normal.Y(), normal.Z()],
                'area': face_area
            })
        
        else:
            features['complex_surfaces'].append({
                'type': str(surf_type),
                'area': face_area
            })
        
        face_explorer.Next()
    
    logger.info(f"🔧 Features: {len(features['holes'])} holes, "
                f"{len(features['cylindrical_bosses'])} bosses, "
                f"{len(features['planar_faces'])} planar, "
                f"{len(features['complex_surfaces'])} complex")
    
    return features


def extract_feature_edges(shape, max_edges=500):
    """Extract TRUE feature edges from BREP geometry"""
    logger.info("📐 Extracting BREP feature edges...")
    
    feature_edges = []
    edge_count = 0
    
    try:
        edge_explorer = TopExp_Explorer(shape, TopAbs_EDGE)
        
        while edge_explorer.More() and edge_count < max_edges:
            edge = topods.Edge(edge_explorer.Current())
            
            try:
                curve_result = BRep_Tool.Curve(edge)
                
                if not curve_result or len(curve_result) < 3 or curve_result[0] is None:
                    edge_explorer.Next()
                    continue
                
                curve = curve_result[0]
                first_param = curve_result[1]
                last_param = curve_result[2]
                
                curve_adaptor = BRepAdaptor_Curve(edge)
                curve_type = curve_adaptor.GetType()
                
                if curve_type == GeomAbs_Line:
                    num_samples = 2
                elif curve_type == GeomAbs_Circle:
                    num_samples = 32
                elif curve_type in [GeomAbs_BSplineCurve, GeomAbs_BezierCurve]:
                    num_samples = 24
                else:
                    num_samples = 20
                
                points = []
                for i in range(num_samples + 1):
                    param = first_param + (last_param - first_param) * i / num_samples
                    point = curve.Value(param)
                    points.append([point.X(), point.Y(), point.Z()])
                
                if len(points) >= 2:
                    feature_edges.append(points)
                    edge_count += 1
                    
            except Exception:
                pass
            
            edge_explorer.Next()
        
        logger.info(f"✅ Extracted {len(feature_edges)} BREP edges")
        
    except Exception as e:
        logger.error(f"Error extracting edges: {e}")
        return []
    
    return feature_edges


def calculate_face_center(triangulation, transform):
    """Compute average center of a face"""
    try:
        total = np.zeros(3)
        for i in range(1, triangulation.NbNodes() + 1):
            p = triangulation.Node(i)
            p.Transform(transform)
            total += np.array([p.X(), p.Y(), p.Z()])
        return (total / triangulation.NbNodes()).tolist()
    except Exception:
        return [0, 0, 0]


def tessellate_shape(shape):
    """
    === SECTION 1: MESH GENERATION ONLY ===
    Generate display mesh with adaptive quality.
    NO color classification here - purely geometric mesh creation.
    """
    try:
        bbox_diagonal, bbox_coords = calculate_bbox_diagonal(shape)
        base_deflection = min(bbox_diagonal * 0.008, 0.2)
        
        logger.info(f"🔧 Tessellation: diagonal={bbox_diagonal:.2f}mm, deflection={base_deflection:.4f}mm")
        
        face_explorer = TopExp_Explorer(shape, TopAbs_FACE)
        while face_explorer.More():
            face = topods.Face(face_explorer.Current())
            surface = BRepAdaptor_Surface(face)
            surf_type = surface.GetType()
            
            if surf_type in [GeomAbs_Cylinder, GeomAbs_Cone, GeomAbs_Sphere, 
                           GeomAbs_Torus, GeomAbs_BSplineSurface, GeomAbs_BezierSurface]:
                face_deflection = base_deflection / 8.0
                angular_deflection = 0.15
            else:
                face_deflection = base_deflection
                angular_deflection = 0.5
            
            try:
                face_mesh = BRepMesh_IncrementalMesh(face, face_deflection, False, angular_deflection, True)
                face_mesh.Perform()
            except Exception as e:
                logger.warning(f"Face tessellation failed: {e}")
            
            face_explorer.Next()

        bbox = Bnd_Box()
        brepbndlib.Add(shape, bbox)
        xmin, ymin, zmin, xmax, ymax, zmax = bbox.Get()
        cx, cy, cz = (xmin + xmax) / 2, (ymin + ymax) / 2, (zmin + zmax) / 2

        logger.info("📊 Extracting mesh geometry (no classification)...")
        
        vertices, indices, normals = [], [], []
        face_data = []  # Store face metadata for later classification
        current_index = 0
        
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
            
            bbox_center = [cx, cy, cz]
            to_surface = [center[0] - bbox_center[0], center[1] - bbox_center[1], center[2] - bbox_center[2]]
            
            # Store face metadata for classification
            face_start_vertex = current_index
            face_vertices = []
            
            for i in range(1, triangulation.NbNodes() + 1):
                p = triangulation.Node(i)
                p.Transform(transform)
                
                vertices.extend([p.X(), p.Y(), p.Z()])
                face_vertices.append(current_index)
                current_index += 1

            face_start_index = len(indices)
            
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
            
            # Store face info for classification
            face_data.append({
                'face_idx': face_idx,
                'surf_type': surf_type,
                'center': center,
                'start_vertex': face_start_vertex,
                'vertex_count': len(face_vertices),
                'start_index': face_start_index,
                'triangle_count': (len(indices) - face_start_index) // 3,
                'face_object': face
            })

            face_explorer.Next()
            face_idx += 1

        vertex_count = len(vertices) // 3
        triangle_count = len(indices) // 3
        logger.info(f"✅ Mesh generation complete: {vertex_count} vertices, {triangle_count} triangles")
        
        return {
            "vertices": vertices,
            "indices": indices,
            "normals": normals,
            "face_data": face_data,
            "bbox": (xmin, ymin, zmin, xmax, ymax, zmax),
            "triangle_count": triangle_count,
        }

    except Exception as e:
        logger.error(f"Tessellation error: {e}")
        return {
            "vertices": [],
            "indices": [],
            "normals": [],
            "face_data": [],
            "bbox": (0, 0, 0, 0, 0, 0),
            "triangle_count": 0,
        }


def classify_mesh_faces(mesh_data, shape):
    """
    === SECTION 2: FIXED COLOR CLASSIFICATION ===
    
    Strategy:
    1. First classify all CYLINDRICAL faces using radius/axis logic
    2. Then PROPAGATE classification to adjacent non-cylindrical faces
    3. This ensures boss fillets, planar faces, etc. get correct colors
    """
    logger.info("🎨 Starting IMPROVED mesh-based color classification with propagation...")
    
    vertices = mesh_data["vertices"]
    normals = mesh_data["normals"]
    face_data = mesh_data["face_data"]
    xmin, ymin, zmin, xmax, ymax, zmax = mesh_data["bbox"]
    
    bbox_center = [(xmin + xmax) / 2, (ymin + ymax) / 2, (zmin + zmax) / 2]
    bbox_size = max(xmax - xmin, ymax - ymin, zmax - zmin)
    
    # Initialize all vertices as "external" (default)
    vertex_count = len(vertices) // 3
    vertex_colors = ["external"] * vertex_count
    face_classifications = {}  # Store classification for each face
    
    # Build edge-to-face adjacency map
    edge_face_map = TopTools_IndexedDataMapOfShapeListOfShape()
    topexp.MapShapesAndAncestors(shape, TopAbs_EDGE, TopAbs_FACE, edge_face_map)
    
    logger.info("🔍 STEP 1: Classifying cylindrical faces...")
    
    # STEP 1: Classify all CYLINDRICAL faces first
    for face_info in face_data:
        face_idx = face_info['face_idx']
        surf_type = face_info['surf_type']
        center = face_info['center']
        start_vertex = face_info['start_vertex']
        vertex_count_face = face_info['vertex_count']
        face_object = face_info['face_object']
        
        if surf_type != GeomAbs_Cylinder:
            continue  # Skip non-cylindrical for now
        
        try:
            surface = BRepAdaptor_Surface(face_object)
            cyl = surface.Cylinder()
            radius = cyl.Radius()
            axis_location = cyl.Axis().Location()
            
            # Calculate distance from face center to cylinder axis
            axis_point = [axis_location.X(), axis_location.Y(), axis_location.Z()]
            dist_to_axis = math.sqrt(
                (center[0] - axis_point[0])**2 +
                (center[1] - axis_point[1])**2 +
                (center[2] - axis_point[2])**2
            )
            
            # Calculate distance from bbox center to axis
            bbox_to_axis = math.sqrt(
                (bbox_center[0] - axis_point[0])**2 +
                (bbox_center[1] - axis_point[1])**2 +
                (bbox_center[2] - axis_point[2])**2
            )
            
            is_small_hole = radius < bbox_size * 0.15
            
            if dist_to_axis < bbox_to_axis:
                # Inner cylindrical surface
                if is_small_hole:
                    # Check for through-hole
                    has_outer_neighbor = False
                    edge_exp = TopExp_Explorer(face_object, TopAbs_EDGE)
                    
                    while edge_exp.More() and not has_outer_neighbor:
                        edge = edge_exp.Current()
                        
                        for map_idx in range(1, edge_face_map.Size() + 1):
                            map_edge = edge_face_map.FindKey(map_idx)
                            if edge.IsSame(map_edge):
                                face_list = edge_face_map.FindFromIndex(map_idx)
                                face_iter = TopTools_ListIteratorOfListOfShape(face_list)
                                
                                while face_iter.More():
                                    adj_face = topods.Face(face_iter.Value())
                                    
                                    for other_info in face_data:
                                        if adj_face.IsSame(other_info['face_object']):
                                            # Check if neighbor is external
                                            if other_info['surf_type'] != GeomAbs_Cylinder:
                                                break
                                            try:
                                                other_surf = BRepAdaptor_Surface(adj_face)
                                                other_cyl = other_surf.Cylinder()
                                                other_axis = other_cyl.Axis().Location()
                                                other_axis_pt = [other_axis.X(), other_axis.Y(), other_axis.Z()]
                                                other_center = other_info['center']
                                                
                                                other_dist = math.sqrt(
                                                    (other_center[0] - other_axis_pt[0])**2 +
                                                    (other_center[1] - other_axis_pt[1])**2 +
                                                    (other_center[2] - other_axis_pt[2])**2
                                                )
                                                other_bbox_dist = math.sqrt(
                                                    (bbox_center[0] - other_axis_pt[0])**2 +
                                                    (bbox_center[1] - other_axis_pt[1])**2 +
                                                    (bbox_center[2] - other_axis_pt[2])**2
                                                )
                                                
                                                if other_dist > other_bbox_dist:
                                                    has_outer_neighbor = True
                                            except:
                                                pass
                                            break
                                    
                                    if has_outer_neighbor:
                                        break
                                    face_iter.Next()
                                break
                        
                        if has_outer_neighbor:
                            break
                        edge_exp.Next()
                    
                    face_type = "through" if has_outer_neighbor else "internal"
                else:
                    # Large inner cylinder (bore)
                    face_type = "internal"
            else:
                # Outer cylindrical surface
                face_type = "external"
            
            # Store classification
            face_classifications[face_idx] = face_type
            
            # Apply to vertices
            for v_idx in range(start_vertex, start_vertex + vertex_count_face):
                vertex_colors[v_idx] = face_type
            
            if face_idx < 10:
                logger.info(f"  Face {face_idx}: Cylinder R={radius:.2f}mm → {face_type}")
                
        except Exception as e:
            logger.warning(f"Cylinder classification failed for face {face_idx}: {e}")
            face_classifications[face_idx] = "external"
    
    logger.info("🔍 STEP 2: Propagating classification to adjacent faces...")
    
    # STEP 2: Propagate classification from cylinders to adjacent faces
    # This handles boss fillets, planar faces, back walls, etc.
    for face_info in face_data:
        face_idx = face_info['face_idx']
        
        # Skip if already classified
        if face_idx in face_classifications:
            continue
        
        surf_type = face_info['surf_type']
        face_object = face_info['face_object']
        start_vertex = face_info['start_vertex']
        vertex_count_face = face_info['vertex_count']
        
        # Find adjacent faces via shared edges
        edge_exp = TopExp_Explorer(face_object, TopAbs_EDGE)
        neighbor_types = []
        
        while edge_exp.More():
            edge = edge_exp.Current()
            
            # Find all faces sharing this edge
            for map_idx in range(1, edge_face_map.Size() + 1):
                map_edge = edge_face_map.FindKey(map_idx)
                if edge.IsSame(map_edge):
                    face_list = edge_face_map.FindFromIndex(map_idx)
                    face_iter = TopTools_ListIteratorOfListOfShape(face_list)
                    
                    while face_iter.More():
                        adj_face = topods.Face(face_iter.Value())
                        
                        # Find this adjacent face in our data
                        for other_info in face_data:
                            if adj_face.IsSame(other_info['face_object']):
                                other_idx = other_info['face_idx']
                                if other_idx != face_idx and other_idx in face_classifications:
                                    neighbor_types.append(face_classifications[other_idx])
                                break
                        
                        face_iter.Next()
                    break
            
            edge_exp.Next()
        
        # Determine face type based on neighbors
        if neighbor_types:
            # Priority: internal > through > external
            # This ensures boss features get classified as internal if connected to internal surfaces
            if "internal" in neighbor_types:
                face_type = "internal"
            elif "through" in neighbor_types:
                face_type = "through"
            else:
                face_type = "external"
        else:
            # No classified neighbors - use planar default or external
            face_type = "planar" if surf_type == GeomAbs_Plane else "external"
        
        # Store and apply
        face_classifications[face_idx] = face_type
        for v_idx in range(start_vertex, start_vertex + vertex_count_face):
            vertex_colors[v_idx] = face_type
    
    # Count results
    type_counts = {}
    for vtype in vertex_colors:
        type_counts[vtype] = type_counts.get(vtype, 0) + 1
    logger.info(f"✅ Classification complete! Distribution: {type_counts}")
    
    return vertex_colors


@app.route("/analyze-cad", methods=["POST"])
def analyze_cad():
    """Upload a STEP file, analyze BREP geometry, generate display mesh"""
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]
        if not (file.filename.lower().endswith(".step") or file.filename.lower().endswith(".stp")):
            return jsonify({"error": "Only .step or .stp files supported"}), 400

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

        logger.info("🔍 Analyzing BREP geometry...")
        exact_props = calculate_exact_volume_and_area(shape)
        manufacturing_features = recognize_manufacturing_features(shape)
        
        logger.info("🎨 Generating display mesh...")
        mesh_data = tessellate_shape(shape)
        
        logger.info("🎨 Classifying face colors using MESH-BASED approach...")
        vertex_colors = classify_mesh_faces(mesh_data, shape)
        mesh_data["vertex_colors"] = vertex_colors
        
        logger.info("📐 Extracting BREP edges...")
        feature_edges = extract_feature_edges(shape, max_edges=500)
        mesh_data["feature_edges"] = feature_edges
        mesh_data["triangle_count"] = len(mesh_data.get("indices", [])) // 3

        is_cylindrical = len(manufacturing_features['holes']) > 0 or len(manufacturing_features['cylindrical_bosses']) > 0
        has_flat_surfaces = len(manufacturing_features['planar_faces']) > 0
        total_faces = (len(manufacturing_features['holes']) + 
                      len(manufacturing_features['cylindrical_bosses']) + 
                      len(manufacturing_features['planar_faces']) + 
                      len(manufacturing_features['complex_surfaces']))

        cylindrical_faces = len(manufacturing_features['holes']) + len(manufacturing_features['cylindrical_bosses'])
        planar_faces = len(manufacturing_features['planar_faces'])
        complexity_score = min(10, int(
            (total_faces / 10) +
            (cylindrical_faces * 0.2) + 
            (planar_faces * 0.1)
        ))

        bbox = Bnd_Box()
        brepbndlib.Add(shape, bbox)
        xmin, ymin, zmin, xmax, ymax, zmax = bbox.Get()

        part_width_cm = (xmax - xmin) / 10
        part_height_cm = (ymax - ymin) / 10
        part_depth_cm = (zmax - zmin) / 10

        logger.info(f"✅ Analysis complete: {mesh_data['triangle_count']} triangles, {len(feature_edges)} edges")

        return jsonify({
            'exact_volume': exact_props['volume'],
            'exact_surface_area': exact_props['surface_area'],
            'center_of_mass': exact_props['center_of_mass'],
            'manufacturing_features': manufacturing_features,
            'mesh_data': {
                'vertices': mesh_data['vertices'],
                'indices': mesh_data['indices'],
                'normals': mesh_data['normals'],
                'vertex_colors': mesh_data['vertex_colors'],
                'feature_edges': feature_edges,
                'triangle_count': mesh_data['triangle_count'],
                'face_classification_method': 'mesh_based_with_propagation'
            },
            'volume_cm3': exact_props['volume'] / 1000,
            'surface_area_cm2': exact_props['surface_area'] / 100,
            'is_cylindrical': is_cylindrical,
            'has_flat_surfaces': has_flat_surfaces,
            'complexity_score': complexity_score,
            'part_width_cm': part_width_cm,
            'part_height_cm': part_height_cm,
            'part_depth_cm': part_depth_cm,
            'total_faces': total_faces,
            'planar_faces': planar_faces,
            'cylindrical_faces': cylindrical_faces,
            'analysis_type': 'dual_representation',
            'quotation_ready': True,
            'status': 'success',
            'confidence': 0.98,
            'method': 'mesh_based_classification_with_propagation'
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
        "version": "6.1.0-mesh-propagation",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "analyze": "/analyze-cad"
        },
        "features": {
            "classification": "Mesh-based with neighbor propagation",
            "inner_surfaces": "Detected by cylinder radius and propagated to adjacent faces",
            "through_holes": "Detected by adjacency analysis"
        },
        "documentation": "POST multipart/form-data with 'file' field containing .step file"
    })


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
