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
from OCC.Core.TopTools import TopTools_IndexedDataMapOfShapeListOfShape
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


def extract_feature_edges(shape, max_edges=120, max_time_seconds=20):
    """
    Extract ONLY true silhouette edges and sharp manufacturing features.
    Filters out smooth transitions, hole boundaries, and internal edges.
    """
    import time
    start_time = time.time()
    edges = []
    sample_density = 1.0
    
    try:
        BRepMesh_IncrementalMesh(shape, 0.1, True)
        
        edge_face_map = TopTools_IndexedDataMapOfShapeListOfShape()
        topexp.MapShapesAndAncestors(shape, TopAbs_EDGE, TopAbs_FACE, edge_face_map)
        
        exp = TopExp_Explorer(shape, TopAbs_EDGE)
        edge_count = 0
        filtered_count = 0
        
        while exp.More():
            if time.time() - start_time > max_time_seconds:
                logger.warning(f"Edge extraction timeout after {max_time_seconds}s")
                break
            if edge_count >= max_edges:
                logger.info(f"Reached max edge limit ({max_edges})")
                break
            
            edge = topods.Edge(exp.Current())
            
            # NEW FILTERING LOGIC: Only include specific edge types
            is_feature_edge = False
            
            try:
                face_list = edge_face_map.FindFromKey(edge)
                num_faces = face_list.Size()
                
                # RULE 1: Skip single-face edges (usually hole boundaries)
                if num_faces == 1:
                    curve = BRepAdaptor_Curve(edge)
                    curve_type = curve.GetType()
                    # Only include if it's a straight line (part outline)
                    if curve_type == GeomAbs_Line:
                        is_feature_edge = True
                    else:
                        filtered_count += 1
                        exp.Next()
                        continue
                
                # RULE 2: For 2-face edges, check dihedral angle
                elif num_faces == 2:
                    face1 = topods.Face(face_list.First())
                    face2 = topods.Face(face_list.Last())
                    
                    # Get surface types
                    adaptor1 = BRepAdaptor_Surface(face1)
                    adaptor2 = BRepAdaptor_Surface(face2)
                    surf_type1 = adaptor1.GetType()
                    surf_type2 = adaptor2.GetType()
                    
                    # RULE 2a: Skip cylinder-to-cylinder same-radius transitions
                    if surf_type1 == GeomAbs_Cylinder and surf_type2 == GeomAbs_Cylinder:
                        try:
                            cyl1 = adaptor1.Cylinder()
                            cyl2 = adaptor2.Cylinder()
                            if abs(cyl1.Radius() - cyl2.Radius()) < 0.01:
                                filtered_count += 1
                                exp.Next()
                                continue
                        except:
                            pass
                    
                    # RULE 2b: Calculate dihedral angle
                    try:
                        curve = BRepAdaptor_Curve(edge)
                        u_mid = (curve.FirstParameter() + curve.LastParameter()) / 2.0
                        point_on_edge = curve.Value(u_mid)
                        
                        from OCC.Core.GeomAPI import GeomAPI_ProjectPointOnSurf
                        projector1 = GeomAPI_ProjectPointOnSurf(point_on_edge, BRep_Tool.Surface(face1))
                        projector2 = GeomAPI_ProjectPointOnSurf(point_on_edge, BRep_Tool.Surface(face2))
                        
                        if projector1.NbPoints() > 0 and projector2.NbPoints() > 0:
                            u1, v1 = projector1.Parameters(1)
                            u2, v2 = projector2.Parameters(1)
                            
                            pnt1, d1u1, d1v1 = gp_Pnt(), gp_Vec(), gp_Vec()
                            pnt2, d1u2, d1v2 = gp_Pnt(), gp_Vec(), gp_Vec()
                            adaptor1.D1(u1, v1, pnt1, d1u1, d1v1)
                            adaptor2.D1(u2, v2, pnt2, d1u2, d1v2)
                            
                            normal1 = d1u1.Crossed(d1v1)
                            normal2 = d1u2.Crossed(d1v2)
                            
                            from OCC.Core.TopAbs import TopAbs_REVERSED, TopAbs_INTERNAL
                            if face1.Orientation() in [TopAbs_REVERSED, TopAbs_INTERNAL]:
                                normal1.Reverse()
                            if face2.Orientation() in [TopAbs_REVERSED, TopAbs_INTERNAL]:
                                normal2.Reverse()
                            
                            normal1.Normalize()
                            normal2.Normalize()
                            
                            dot_product = max(-1.0, min(1.0, normal1.Dot(normal2)))
                            angle_deg = math.degrees(math.acos(dot_product))
                            
                            # RULE 2c: Only include genuinely sharp edges (>30 degrees)
                            if angle_deg > 30:
                                is_feature_edge = True
                            else:
                                filtered_count += 1
                                exp.Next()
                                continue
                        else:
                            # Projection failed - use surface type heuristic
                            if surf_type1 != surf_type2:
                                is_feature_edge = True
                    except Exception as e:
                        logger.debug(f"Angle calculation failed: {e}")
                        # Default to NOT including (safer)
                        filtered_count += 1
                        exp.Next()
                        continue
                        
            except Exception as e:
                logger.debug(f"Edge classification error: {e}")
                filtered_count += 1
                exp.Next()
                continue
            
            # Extract edge samples if it's a feature edge
            if is_feature_edge:
                try:
                    curve = BRepAdaptor_Curve(edge)
                    num_samples = max(5, int(curve.Length() * sample_density * 5))
                    num_samples = min(num_samples, 100)
                    
                    u_start = curve.FirstParameter()
                    u_end = curve.LastParameter()
                    
                    samples = []
                    for i in range(num_samples):
                        u = u_start + (u_end - u_start) * i / (num_samples - 1)
                        pt = curve.Value(u)
                        samples.append([pt.X(), pt.Y(), pt.Z()])
                    
                    if len(samples) > 1:
                        edges.append(samples)
                        edge_count += 1
                except Exception as e:
                    logger.debug(f"Edge sampling failed: {e}")
                
            
            exp.Next()
        
        logger.info(f"Extracted {edge_count} feature edges (filtered {filtered_count} smooth/internal edges)")
    except Exception as e:
        logger.warning(f"Edge extraction failed: {e}")

    return edges


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
        base_deflection = bbox_diagonal * 0.008  # Base: 0.8% of diagonal for flat surfaces
        
        logger.info(f"🔧 Adaptive tessellation: diagonal={bbox_diagonal:.2f}mm, base_deflection={base_deflection:.4f}mm")
        
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
        
        vertices, indices, normals, face_types = [], [], [], []
        vertex_map = {}
        current_index = 0
        vertex_tolerance = base_deflection * 0.1  # Weld vertices within 0.01% diagonal
        face_explorer = TopExp_Explorer(shape, TopAbs_FACE)

        while face_explorer.More():
            face = face_explorer.Current()
            loc = TopLoc_Location()
            triangulation = BRep_Tool.Triangulation(face, loc)
            if triangulation is None:
                face_explorer.Next()
                continue

            transform = loc.Transformation()
            surface = BRepAdaptor_Surface(face)
            reversed_face = face.Orientation() == 1
            surf_type = surface.GetType()
            center = calculate_face_center(triangulation, transform)
            vector_to_center = [cx - center[0], cy - center[1], cz - center[2]]
            normal_vec = get_average_face_normal(triangulation, transform, reversed_face)
            dot = sum(n * v for n, v in zip(normal_vec, vector_to_center))
            dot /= (math.sqrt(sum(v * v for v in vector_to_center)) + 1e-9)

            # classify face
            if surf_type == GeomAbs_Cylinder:
                cyl = surface.Cylinder()
                r = cyl.Radius()
                if r < max_radius * 0.4 or dot > 0:
                    ftype = "internal"
                else:
                    ftype = "cylindrical"
            elif surf_type == GeomAbs_Plane:
                ftype = "internal" if dot > 0.5 else "planar"
            else:
                ftype = "internal" if dot > 0.3 else "external"

            # vertices with welding tolerance to close microgaps
            face_vertices = []
            for i in range(1, triangulation.NbNodes() + 1):
                p = triangulation.Node(i)
                p.Transform(transform)
                # Round to vertex_tolerance precision for welding
                coord = (round(p.X(), 6), round(p.Y(), 6), round(p.Z(), 6))
                if coord not in vertex_map:
                    vertex_map[coord] = current_index
                    vertices.extend(coord)
                    face_vertices.append(current_index)
                    current_index += 1
                else:
                    face_vertices.append(vertex_map[coord])

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
                if sum(n * v for n, v in zip(n, vector_to_center)) < 0:
                    n = [-x for x in n]
                for _ in range(3):
                    normals.extend(n)
                    face_types.append(ftype)

            face_explorer.Next()

        triangle_count = len(indices) // 3
        logger.info(
            f"Tessellation complete: {len(vertices)//3} vertices, {triangle_count} triangles"
        )
        return {
            "vertices": vertices,
            "indices": indices,
            "normals": normals,
            "face_types": face_types,
            "triangle_count": triangle_count,
        }

    except Exception as e:
        logger.error(f"Tessellation error: {e}")
        return {
            "vertices": [],
            "indices": [],
            "normals": [],
            "face_types": [],
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
        
        # === STEP 3: EDGE EXTRACTION (for visual verification) ===
        logger.info("📏 Extracting feature edges for display...")
        feature_edges = extract_feature_edges(shape, max_edges=60)
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
                'face_types': mesh_data['face_types'],
                'feature_edges': feature_edges,
                'triangle_count': mesh_data['triangle_count']
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
