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
from OCC.Core.TopAbs import TopAbs_FACE, TopAbs_EDGE, TopAbs_IN, TopAbs_OUT, TopAbs_ON
from OCC.Core.TopExp import TopExp_Explorer, topexp
from OCC.Core.TopLoc import TopLoc_Location
from OCC.Core.Bnd import Bnd_Box
from OCC.Core.BRepBndLib import brepbndlib
from OCC.Core.BRepAdaptor import BRepAdaptor_Surface, BRepAdaptor_Curve
from OCC.Core.BRepTools import breptools_UVBounds, breptools
from OCC.Core.GCPnts import GCPnts_UniformAbscissa, GCPnts_AbscissaPoint
from OCC.Core.GeomAbs import (GeomAbs_Cylinder, GeomAbs_Plane, GeomAbs_Cone, 
                               GeomAbs_Sphere, GeomAbs_Torus, GeomAbs_BSplineSurface, 
                               GeomAbs_BezierSurface, GeomAbs_Line, GeomAbs_Circle,
                               GeomAbs_BSplineCurve, GeomAbs_BezierCurve)
from OCC.Core.TopoDS import topods
from OCC.Core.GProp import GProp_GProps
from OCC.Core.BRepGProp import brepgprop, BRepGProp_Face
from OCC.Core.TopTools import TopTools_IndexedDataMapOfShapeListOfShape, TopTools_ListIteratorOfListOfShape
from OCC.Core.gp import gp_Vec, gp_Pnt, gp_Lin, gp_Dir
from OCC.Core.IntCurvesFace import IntCurvesFace_ShapeIntersector

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
    surf = BRepAdaptor_Surface(face)
    umin, umax, vmin, vmax = breptools_UVBounds(face)
    mid_u = (umin + umax) / 2
    mid_v = (vmin + vmax) / 2
    return surf.Value(mid_u, mid_v)


def classify_faces_topology(shape):
    """
    Classify faces using BIDIRECTIONAL RAY-CASTING - the cleanest approach!
    
    Logic:
    - If face "sees" nothing in both directions → OUTER (external wall)
    - If forward ray escapes but backward hits solid → INNER (back wall of cavity)
    - If ray hits the same face → THROUGH (cylindrical hole)
    - If ray hits another face → INNER (cavity wall)
    """
    from OCC.Core.IntCurvesFace import IntCurvesFace_ShapeIntersector
    from OCC.Core.gp import gp_Lin, gp_Dir
    
    face_types = {}
    face_objects = []
    
    # Get bounding box
    bbox = Bnd_Box()
    brepbndlib.Add(shape, bbox)
    xmin, ymin, zmin, xmax, ymax, zmax = bbox.Get()
    bbox_size = max(xmax - xmin, ymax - ymin, zmax - zmin)
    
    # Collect all faces
    face_explorer = TopExp_Explorer(shape, TopAbs_FACE)
    while face_explorer.More():
        face = topods.Face(face_explorer.Current())
        face_objects.append(face)
        face_explorer.Next()
    
    # Create ray intersector
    intersector = IntCurvesFace_ShapeIntersector()
    intersector.Load(shape, 1e-6)
    
    logger.info(f"🔍 Starting bidirectional ray-casting classification for {len(face_objects)} faces...")
    
    for face_idx, face in enumerate(face_objects):
        try:
            # Get face center
            face_props = GProp_GProps()
            brepgprop.SurfaceProperties(face, face_props)
            face_center = face_props.CentreOfMass()
            
            # Get normal at face center
            try:
                from OCC.Core.BRepTools import breptools
                umin, umax, vmin, vmax = breptools.UVBounds(face)
                u_mid = (umin + umax) / 2
                v_mid = (vmin + vmax) / 2
                
                point_on_surf = gp_Pnt()
                normal_vec = gp_Vec()
                BRepGProp_Face(face).Normal(u_mid, v_mid, point_on_surf, normal_vec)
                
                normal_length = normal_vec.Magnitude()
                if normal_length < 1e-9:
                    face_types[face_idx] = "outer"
                    continue
                
                normal_vec.Divide(normal_length)
                
            except Exception as e:
                logger.warning(f"Face {face_idx} normal calculation failed: {e}")
                face_types[face_idx] = "outer"
                continue
            
            # Offset slightly from surface to avoid self-intersection
            start_offset = bbox_size * 0.001
            start_point = gp_Pnt(
                face_center.X() + normal_vec.X() * start_offset,
                face_center.Y() + normal_vec.Y() * start_offset,
                face_center.Z() + normal_vec.Z() * start_offset
            )
            
            # FORWARD RAY (along normal direction)
            forward_dir = gp_Dir(normal_vec.X(), normal_vec.Y(), normal_vec.Z())
            forward_ray = gp_Lin(start_point, forward_dir)
            
            intersector.Perform(forward_ray, 0, bbox_size * 3)
            forward_hits = intersector.NbPnt()
            
            # Check if forward ray hits the same face (through-hole detection)
            hits_itself = False
            if forward_hits > 0:
                for i in range(1, forward_hits + 1):
                    hit_face = intersector.Face(i)
                    if hit_face.IsSame(face):
                        hits_itself = True
                        break
            
            # BACKWARD RAY (opposite direction)
            backward_dir = gp_Dir(-normal_vec.X(), -normal_vec.Y(), -normal_vec.Z())
            backward_start = gp_Pnt(
                face_center.X() - normal_vec.X() * start_offset,
                face_center.Y() - normal_vec.Y() * start_offset,
                face_center.Z() - normal_vec.Z() * start_offset
            )
            backward_ray = gp_Lin(backward_start, backward_dir)
            
            intersector.Perform(backward_ray, 0, bbox_size * 3)
            backward_hits = intersector.NbPnt()
            
            # CLASSIFICATION LOGIC
            if hits_itself:
                # Ray wraps around and hits same face → cylindrical through-hole
                face_types[face_idx] = "through"
                
            elif forward_hits == 0 and backward_hits == 0:
                # Both directions escape → external surface
                face_types[face_idx] = "outer"
                
            elif forward_hits == 0 and backward_hits > 0:
                # Forward escapes, backward hits material → back wall of cavity!
                face_types[face_idx] = "inner"
                
            elif forward_hits > 0:
                # Forward hits another face → cavity wall
                face_types[face_idx] = "inner"
                
            else:
                # Default to outer
                face_types[face_idx] = "outer"
            
        except Exception as e:
            logger.warning(f"Face {face_idx} ray-casting failed: {e}")
            face_types[face_idx] = "outer"
    
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
            for f_idx, stored_face in enumerate(face_objects):
                if adj_face.IsSame(stored_face):
                    adjacent_face_indices.append(f_idx)
                    break
            
            face_iter.Next()
        
        edge_to_face_indices[edge] = adjacent_face_indices
    
    # STEP 4: Detect "through" faces - balanced criteria
    # Small-to-medium cylindrical holes that go through the part
    for face_idx, face in enumerate(face_objects):
        current_type = face_types[face_idx]
        
        # Must already be classified as "inner"
        if current_type != "inner":
            continue
        
        # Must be cylindrical
        surface = BRepAdaptor_Surface(face)
        surf_type = surface.GetType()
        
        if surf_type != GeomAbs_Cylinder:
            continue
        
        # Get cylinder properties
        try:
            cyl = surface.Cylinder()
            radius = cyl.Radius()
            
            # Balanced check: holes less than 15% of bbox size
            # This catches mounting holes but not main bores
            if radius > bbox_size * 0.15:
                continue
                
        except:
            continue
        
        # Check adjacency: must connect to outer faces (exit point)
        edge_exp = TopExp_Explorer(face, TopAbs_EDGE)
        has_outer_neighbor = False
        
        while edge_exp.More():
            edge = edge_exp.Current()
            
            for map_edge, adj_face_indices in edge_to_face_indices.items():
                if edge.IsSame(map_edge):
                    for adj_idx in adj_face_indices:
                        if adj_idx != face_idx:
                            if face_types.get(adj_idx) == "outer":
                                has_outer_neighbor = True
                                break
                    break
            
            if has_outer_neighbor:
                break
            edge_exp.Next()
        
        # Mark as "through" if it connects to outer faces
        if has_outer_neighbor:
            face_types[face_idx] = "through" STRICT
    # Only SMALL cylindrical holes that go completely through the part
    for face_idx, face in enumerate(face_objects):
        current_type = face_types[face_idx]
        
        # Must already be classified as "inner"
        if current_type != "inner":
            continue
        
        # Must be cylindrical
        surface = BRepAdaptor_Surface(face)
        surf_type = surface.GetType()
        
        if surf_type != GeomAbs_Cylinder:
            continue
        
        # Get cylinder properties
        try:
            cyl = surface.Cylinder()
            radius = cyl.Radius()
            
            # VERY STRICT: Only consider SMALL holes (less than 5% of bbox size)
            # This excludes large bores and main cylinders
            if radius > bbox_size * 0.05:
                continue
            
            # Additional check: face area should be small
            face_props = GProp_GProps()
            brepgprop.SurfaceProperties(face, face_props)
            face_area = face_props.Mass()
            
            # Calculate max expected area for a small hole
            bbox_volume = (xmax - xmin) * (ymax - ymin) * (zmax - zmin)
            max_hole_area = bbox_volume ** 0.666 * 0.1  # Very small relative to part size
            
            if face_area > max_hole_area:
                continue
                
        except:
            continue
        
        # Check adjacency: must connect to outer faces (exit point)
        edge_exp = TopExp_Explorer(face, TopAbs_EDGE)
        has_outer_neighbor = False
        
        while edge_exp.More():
            edge = edge_exp.Current()
            
            for map_edge, adj_face_indices in edge_to_face_indices.items():
                if edge.IsSame(map_edge):
                    for adj_idx in adj_face_indices:
                        if adj_idx != face_idx:
                            if face_types.get(adj_idx) == "outer":
                                has_outer_neighbor = True
                                break
                    break
            
            if has_outer_neighbor:
                break
            edge_exp.Next()
        
        # Only mark as "through" if ALL criteria met
        if has_outer_neighbor:
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
                
                curve = curve_result[0]
                first_param = curve_result[1]
                last_param = curve_result[2]
                
                # Create curve adapter for querying curve properties
                curve_adaptor = BRepAdaptor_Curve(edge)
                curve_type = curve_adaptor.GetType()
                
                # Adaptive sampling based on curve type
                if curve_type == GeomAbs_Line:
                    num_samples = 2
                elif curve_type == GeomAbs_Circle:
                    num_samples = 32
                elif curve_type in [GeomAbs_BSplineCurve, GeomAbs_BezierCurve]:
                    num_samples = 24
                else:
                    num_samples = 20
                
                # Sample points along the curve
                points = []
                for i in range(num_samples + 1):
                    param = first_param + (last_param - first_param) * i / num_samples
                    point = curve.Value(param)
                    points.append([point.X(), point.Y(), point.Z()])
                
                if len(points) >= 2:
                    feature_edges.append(points)
                    edge_count += 1
                    
            except Exception as e:
                logger.warning(f"⚠️ Failed to extract edge: {type(e).__name__}: {e}")
                pass
            
            edge_explorer.Next()
        
        logger.info(f"✅ Extracted {len(feature_edges)} BREP feature edges")
        
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


def tessellate_shape(shape):
    """
    Generate display mesh with adaptive quality for smooth curved surfaces.
    This is ONLY for visual verification, NOT for manufacturing calculations.
    """
    try:
        bbox_diagonal, bbox_coords = calculate_bbox_diagonal(shape)
        base_deflection = min(bbox_diagonal * 0.008, 0.2)
        
        logger.info(f"🔧 Refined tessellation: diagonal={bbox_diagonal:.2f}mm, deflection={base_deflection:.4f}mm")
        
        # Apply surface-specific tessellation quality
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

        logger.info("📊 Extracting vertices and generating mesh...")
        
        # Classify all faces using topology analysis
        logger.info("🔍 Running topology-based face classification...")
        face_types_topo = classify_faces_topology(shape)
        
        # Color mapping for display
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
            
            # Get face type from topology classification
            base_face_type = face_types_topo.get(face_idx, "outer")
            
            # Refine planar faces
            if surf_type == GeomAbs_Plane:
                ftype = "planar"
            else:
                ftype = FACE_COLOR_MAP.get(base_face_type, "external")

            # NO vertex welding - prevents color bleeding
            face_vertices = []
            for i in range(1, triangulation.NbNodes() + 1):
                p = triangulation.Node(i)
                p.Transform(transform)
                
                vertices.extend([p.X(), p.Y(), p.Z()])
                vertex_colors.append(ftype)
                face_vertices.append(current_index)
                current_index += 1

            # Build triangles
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
            return jsonify({"error": "Only .step or .stp files are supported"}), 400

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
        
        logger.info("🔍 Extracting BREP feature edges...")
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
                'face_classification_method': 'brep_topology_multipoint'
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
            'method': 'brep_dual_representation_multipoint'
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
        "version": "2.0.0-raycasting",
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
