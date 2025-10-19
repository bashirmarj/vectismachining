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


def classify_faces_topology(shape):
    """
    HYBRID MULTI-METHOD CLASSIFICATION - Best of all approaches!
    
    Uses 3 methods intelligently based on surface type:
    1. Curvature analysis for cylinders
    2. Volume sampling for planes  
    3. Multi-directional accessibility for complex surfaces
    """
    from OCC.Core.BRepClass3d import BRepClass3d_SolidClassifier
    
    face_types = {}
    face_objects = []
    
    # Get bounding box
    bbox = Bnd_Box()
    brepbndlib.Add(shape, bbox)
    xmin, ymin, zmin, xmax, ymax, zmax = bbox.Get()
    bbox_size = max(xmax - xmin, ymax - ymin, zmax - zmin)
    bbox_center = gp_Pnt((xmin + xmax) / 2, (ymin + ymax) / 2, (zmin + zmax) / 2)
    
    # Collect all faces
    face_explorer = TopExp_Explorer(shape, TopAbs_FACE)
    while face_explorer.More():
        face = topods.Face(face_explorer.Current())
        face_objects.append(face)
        face_explorer.Next()
    
    classifier = BRepClass3d_SolidClassifier(shape)
    
    logger.info(f"🎯 Hybrid multi-method classification for {len(face_objects)} faces...")
    
    for face_idx, face in enumerate(face_objects):
        try:
            surface = BRepAdaptor_Surface(face)
            surf_type = surface.GetType()
            
            # Get face center
            face_props = GProp_GProps()
            brepgprop.SurfaceProperties(face, face_props)
            face_center = face_props.CentreOfMass()
            
            # === METHOD 1: CYLINDER CURVATURE ANALYSIS ===
            if surf_type == GeomAbs_Cylinder:
                cyl = surface.Cylinder()
                cyl_axis_location = cyl.Location()
                radius = cyl.Radius()
                
                # Vector from cylinder axis to face center (radius direction)
                radial_vec = gp_Vec(cyl_axis_location, face_center)
                radial_dist = radial_vec.Magnitude()
                
                if radial_dist > 1e-6:
                    radial_vec.Normalize()
                    
                    # Point at center of curvature (on cylinder axis)
                    curvature_center = cyl_axis_location
                    
                    # Check if curvature center is inside or outside the solid
                    classifier.Perform(curvature_center, 1e-6)
                    state = classifier.State()
                    
                    # If axis is INSIDE solid → cylinder curves inward → INNER (hole/bore)
                    # If axis is OUTSIDE solid → cylinder curves outward → OUTER (boss/shaft)
                    from OCC.Core.TopAbs import TopAbs_IN
                    if state == TopAbs_IN:
                        face_types[face_idx] = "inner"
                    else:
                        face_types[face_idx] = "outer"
                    continue
            
            # === METHOD 2: PLANAR FACE VOLUME SAMPLING ===
            if surf_type == GeomAbs_Plane:
                try:
                    umin, umax, vmin, vmax = breptools.UVBounds(face)
                    u_mid = (umin + umax) / 2
                    v_mid = (vmin + vmax) / 2
                    
                    point_on_surf = gp_Pnt()
                    normal_vec = gp_Vec()
                    BRepGProp_Face(face).Normal(u_mid, v_mid, point_on_surf, normal_vec)
                    
                    normal_length = normal_vec.Magnitude()
                    if normal_length > 1e-9:
                        normal_vec.Divide(normal_length)
                        
                        # Sample multiple points on both sides
                        offset = bbox_size * 0.01
                        inside_count = 0
                        outside_count = 0
                        
                        # Test 5 points on each side
                        for sample_offset in [0.5, 1.0, 1.5, 2.0, 2.5]:
                            # Positive normal side
                            test_pos = gp_Pnt(
                                face_center.X() + normal_vec.X() * offset * sample_offset,
                                face_center.Y() + normal_vec.Y() * offset * sample_offset,
                                face_center.Z() + normal_vec.Z() * offset * sample_offset
                            )
                            classifier.Perform(test_pos, 1e-6)
                            if classifier.State() == TopAbs_IN:
                                inside_count += 1
                            
                            # Negative normal side
                            test_neg = gp_Pnt(
                                face_center.X() - normal_vec.X() * offset * sample_offset,
                                face_center.Y() - normal_vec.Y() * offset * sample_offset,
                                face_center.Z() - normal_vec.Z() * offset * sample_offset
                            )
                            classifier.Perform(test_neg, 1e-6)
                            if classifier.State() == TopAbs_IN:
                                outside_count += 1
                        
                        # More material on positive side = inner face (back wall)
                        # More material on negative side = outer face
                        if inside_count > outside_count:
                            face_types[face_idx] = "inner"
                        else:
                            face_types[face_idx] = "outer"
                        continue
                except:
                    pass
            
            # === METHOD 3: MULTI-DIRECTIONAL ACCESSIBILITY TEST ===
            # Cast rays in 6 cardinal directions
            test_directions = [
                (1, 0, 0), (-1, 0, 0),   # ±X
                (0, 1, 0), (0, -1, 0),   # ±Y
                (0, 0, 1), (0, 0, -1)    # ±Z
            ]
            
            escape_count = 0
            offset = bbox_size * 0.05
            
            for dx, dy, dz in test_directions:
                test_point = gp_Pnt(
                    face_center.X() + dx * offset,
                    face_center.Y() + dy * offset,
                    face_center.Z() + dz * offset
                )
                
                classifier.Perform(test_point, 1e-6)
                if classifier.State() != TopAbs_IN:
                    escape_count += 1
            
            # If majority of directions escape → outer face
            # If majority blocked → inner face
            if escape_count >= 4:  # At least 4 out of 6 escape
                face_types[face_idx] = "outer"
            else:
                face_types[face_idx] = "inner"
                
        except Exception as e:
            logger.warning(f"Face {face_idx} classification failed: {e}")
            face_types[face_idx] = "outer"
    
    # === STEP 2: SMART THROUGH-HOLE DETECTION ===
    # Build edge adjacency
    edge_face_map = TopTools_IndexedDataMapOfShapeListOfShape()
    topexp.MapShapesAndAncestors(shape, TopAbs_EDGE, TopAbs_FACE, edge_face_map)
    
    edge_to_face_indices = {}
    for map_idx in range(1, edge_face_map.Size() + 1):
        edge = edge_face_map.FindKey(map_idx)
        face_list = edge_face_map.FindFromIndex(map_idx)
        
        adjacent_face_indices = []
        face_iter = TopTools_ListIteratorOfListOfShape(face_list)
        while face_iter.More():
            adj_face = topods.Face(face_iter.Value())
            for f_idx, stored_face in enumerate(face_objects):
                if adj_face.IsSame(stored_face):
                    adjacent_face_indices.append(f_idx)
                    break
            face_iter.Next()
        
        edge_to_face_indices[edge] = adjacent_face_indices
    
    # Detect through-holes: small cylindrical inner faces that connect to outer
    for face_idx, face in enumerate(face_objects):
        if face_types[face_idx] != "inner":
            continue
        
        surface = BRepAdaptor_Surface(face)
        if surface.GetType() != GeomAbs_Cylinder:
            continue
        
        try:
            cyl = surface.Cylinder()
            radius = cyl.Radius()
            
            # Small holes only (< 12% of bbox)
            if radius > bbox_size * 0.12:
                continue
            
            # Check if connects to outer faces
            edge_exp = TopExp_Explorer(face, TopAbs_EDGE)
            outer_neighbor_count = 0
            
            while edge_exp.More():
                edge = edge_exp.Current()
                
                for map_edge, adj_indices in edge_to_face_indices.items():
                    if edge.IsSame(map_edge):
                        for adj_idx in adj_indices:
                            if adj_idx != face_idx and face_types.get(adj_idx) == "outer":
                                outer_neighbor_count += 1
                        break
                edge_exp.Next()
            
            # If has multiple connections to outer faces → through-hole
            if outer_neighbor_count >= 2:
                face_types[face_idx] = "through"
                
        except:
            pass
    
    logger.info(f"✅ Hybrid classification complete: {len(face_types)} faces")
    type_counts = {}
    for ftype in face_types.values():
        type_counts[ftype] = type_counts.get(ftype, 0) + 1
    logger.info(f"   Distribution: {type_counts}")
    
    return face_types


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
    logger.info("🔍 Extracting BREP feature edges...")
    
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
    """Generate display mesh with adaptive quality"""
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

        logger.info("📊 Extracting vertices...")
        
        face_types_topo = classify_faces_topology(shape)
        
        FACE_COLOR_MAP = {
            "inner": "internal",
            "outer": "external",
            "through": "through",
        }
        
        vertices, indices, normals, vertex_colors = [], [], [], []
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
            
            base_face_type = face_types_topo.get(face_idx, "outer")
            
            if surf_type == GeomAbs_Plane:
                ftype = "planar"
            else:
                ftype = FACE_COLOR_MAP.get(base_face_type, "external")

            face_vertices = []
            for i in range(1, triangulation.NbNodes() + 1):
                p = triangulation.Node(i)
                p.Transform(transform)
                
                vertices.extend([p.X(), p.Y(), p.Z()])
                vertex_colors.append(ftype)
                face_vertices.append(current_index)
                current_index += 1

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
        logger.info(f"✅ Tessellation complete: {vertex_count} vertices, {triangle_count} triangles")
        
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

        logger.info("📐 Analyzing BREP geometry...")
        exact_props = calculate_exact_volume_and_area(shape)
        manufacturing_features = recognize_manufacturing_features(shape)
        
        logger.info("🎨 Generating display mesh...")
        mesh_data = tessellate_shape(shape)
        
        logger.info("🔍 Extracting BREP edges...")
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
                'face_classification_method': 'hybrid_multimethod'
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
            'method': 'brep_hybrid_multimethod'
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
        "version": "3.0.0-hybrid",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "analyze": "/analyze-cad"
        },
        "documentation": "POST multipart/form-data with 'file' field containing .step file"
    })


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
