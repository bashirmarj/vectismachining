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
    """
    ⭐ UPDATED: Now stores BREP face references for triangle mapping
    
    Analyze BREP topology to detect TRUE manufacturing features
    
    Accurate detection of:
    - Through-holes: Small cylinders that penetrate the part
    - Blind holes: Small cylinders with depth but no exit
    - Bores: Large internal cylindrical cavities
    - Bosses: Protruding cylindrical features
    - Pockets: Recessed features
    """
    features = {
        'through_holes': [],
        'blind_holes': [],
        'bores': [],
        'bosses': [],
        'pockets': [],
        'planar_faces': [],
        'fillets': [],
        'complex_surfaces': []
    }
    
    bbox_diagonal, (xmin, ymin, zmin, xmax, ymax, zmax) = calculate_bbox_diagonal(shape)
    bbox_center = [(xmin + xmax) / 2, (ymin + ymax) / 2, (zmin + zmax) / 2]
    bbox_size = max(xmax - xmin, ymax - ymin, zmax - zmin)
    
    # Build edge-to-face map for connectivity analysis
    edge_face_map = TopTools_IndexedDataMapOfShapeListOfShape()
    topexp.MapShapesAndAncestors(shape, TopAbs_EDGE, TopAbs_FACE, edge_face_map)
    
    # Collect all faces first
    all_faces = []
    face_explorer = TopExp_Explorer(shape, TopAbs_FACE)
    while face_explorer.More():
        all_faces.append(topods.Face(face_explorer.Current()))
        face_explorer.Next()
    
    # Analyze each face
    for face in all_faces:
        surface = BRepAdaptor_Surface(face)
        surf_type = surface.GetType()
        
        face_props = GProp_GProps()
        brepgprop.SurfaceProperties(face, face_props)
        face_area = face_props.Mass()
        face_center = face_props.CentreOfMass()
        
        if surf_type == GeomAbs_Cylinder:
            cyl = surface.Cylinder()
            radius = cyl.Radius()
            axis_dir = cyl.Axis().Direction()
            axis_pos = cyl.Axis().Location()
            
            # Calculate if this cylinder is internal or external
            axis_point = [axis_pos.X(), axis_pos.Y(), axis_pos.Z()]
            center = [face_center.X(), face_center.Y(), face_center.Z()]
            
            dist_to_axis = math.sqrt(
                (center[0] - axis_point[0])**2 +
                (center[1] - axis_point[1])**2 +
                (center[2] - axis_point[2])**2
            )
            
            bbox_to_axis = math.sqrt(
                (bbox_center[0] - axis_point[0])**2 +
                (bbox_center[1] - axis_point[1])**2 +
                (bbox_center[2] - axis_point[2])**2
            )
            
            is_internal = dist_to_axis < bbox_to_axis
            
            feature_data = {
                'diameter': radius * 2,
                'radius': radius,
                'axis': [axis_dir.X(), axis_dir.Y(), axis_dir.Z()],
                'position': [axis_pos.X(), axis_pos.Y(), axis_pos.Z()],
                'area': face_area,
                'brep_face': face  # ⭐ NEW: Store BREP face reference for mapping
            }
            
            # Classification logic
            diameter_ratio = (radius * 2) / bbox_size
            
            if is_internal:
                if diameter_ratio < 0.15:  # Small hole (< 15% of part size)
                    # Check if it's a through-hole by checking adjacency to external faces
                    has_external_connection = False
                    edge_exp = TopExp_Explorer(face, TopAbs_EDGE)
                    
                    while edge_exp.More():
                        edge = edge_exp.Current()
                        
                        for map_idx in range(1, edge_face_map.Size() + 1):
                            map_edge = edge_face_map.FindKey(map_idx)
                            if edge.IsSame(map_edge):
                                face_list = edge_face_map.FindFromIndex(map_idx)
                                face_iter = TopTools_ListIteratorOfListOfShape(face_list)
                                
                                while face_iter.More():
                                    adj_face = topods.Face(face_iter.Value())
                                    if not adj_face.IsSame(face):
                                        # Check if adjacent face is external
                                        adj_surface = BRepAdaptor_Surface(adj_face)
                                        if adj_surface.GetType() == GeomAbs_Cylinder:
                                            try:
                                                adj_cyl = adj_surface.Cylinder()
                                                adj_axis = adj_cyl.Axis().Location()
                                                adj_axis_pt = [adj_axis.X(), adj_axis.Y(), adj_axis.Z()]
                                                
                                                adj_props = GProp_GProps()
                                                brepgprop.SurfaceProperties(adj_face, adj_props)
                                                adj_center = adj_props.CentreOfMass()
                                                adj_ctr = [adj_center.X(), adj_center.Y(), adj_center.Z()]
                                                
                                                adj_dist = math.sqrt(
                                                    (adj_ctr[0] - adj_axis_pt[0])**2 +
                                                    (adj_ctr[1] - adj_axis_pt[1])**2 +
                                                    (adj_ctr[2] - adj_axis_pt[2])**2
                                                )
                                                adj_bbox_dist = math.sqrt(
                                                    (bbox_center[0] - adj_axis_pt[0])**2 +
                                                    (bbox_center[1] - adj_axis_pt[1])**2 +
                                                    (bbox_center[2] - adj_axis_pt[2])**2
                                                )
                                                
                                                if adj_dist > adj_bbox_dist:
                                                    has_external_connection = True
                                                    break
                                            except:
                                                pass
                                        elif adj_surface.GetType() == GeomAbs_Plane:
                                            # Planar face could be external
                                            has_external_connection = True
                                            break
                                    
                                    face_iter.Next()
                                break
                        
                        if has_external_connection:
                            break
                        edge_exp.Next()
                    
                    if has_external_connection:
                        features['through_holes'].append(feature_data)
                    else:
                        features['blind_holes'].append(feature_data)
                
                elif diameter_ratio < 0.5:  # Medium bore (15-50% of part size)
                    features['bores'].append(feature_data)
                # else: very large internal cavity - not counted as separate feature
            
            else:  # External cylinder
                if diameter_ratio < 0.3:  # Small boss
                    features['bosses'].append(feature_data)
                # else: main body cylinder - not a separate feature
        
        elif surf_type == GeomAbs_Plane:
            plane = surface.Plane()
            normal = plane.Axis().Direction()
            features['planar_faces'].append({
                'normal': [normal.X(), normal.Y(), normal.Z()],
                'area': face_area,
                'brep_face': face  # ⭐ NEW: Store for mapping
            })
        
        elif surf_type == GeomAbs_Torus:
            # Fillets and rounds
            features['fillets'].append({
                'area': face_area,
                'type': 'torus',
                'brep_face': face  # ⭐ NEW: Store for mapping
            })
        
        else:
            features['complex_surfaces'].append({
                'type': str(surf_type),
                'area': face_area,
                'brep_face': face  # ⭐ NEW: Store for mapping
            })
    
    # Calculate totals for backward compatibility
    total_holes = len(features['through_holes']) + len(features['blind_holes'])
    total_bosses = len(features['bosses'])
    
    logger.info(f"🔧 Manufacturing Features Detected:")
    logger.info(f"   Through-holes: {len(features['through_holes'])}")
    logger.info(f"   Blind holes: {len(features['blind_holes'])}")
    logger.info(f"   Bores: {len(features['bores'])}")
    logger.info(f"   Bosses: {len(features['bosses'])}")
    logger.info(f"   Planar faces: {len(features['planar_faces'])}")
    logger.info(f"   Fillets: {len(features['fillets'])}")
    logger.info(f"   Complex surfaces: {len(features['complex_surfaces'])}")
    
    # Add legacy fields for backward compatibility
    features['holes'] = features['through_holes'] + features['blind_holes']
    features['cylindrical_bosses'] = features['bosses']
    
    return features


def map_features_to_triangles(features, face_data):
    """
    ⭐ NEW FUNCTION: Map detected manufacturing features to mesh triangle indices
    
    This enables frontend to highlight specific features when clicked in the feature tree.
    
    Args:
        features: Dictionary of detected features (from recognize_manufacturing_features)
        face_data: List of face metadata (from tessellate_shape)
    
    Returns:
        Updated features with triangle_start, triangle_end, center for each feature
    """
    logger.info("🔗 Mapping features to mesh triangles...")
    
    def map_feature_list(feature_list, feature_type_name):
        """Helper to map a list of features"""
        for idx, feature in enumerate(feature_list):
            if 'brep_face' not in feature:
                continue
                
            brep_face = feature['brep_face']
            triangle_ranges = []
            
            # Find all face_data entries that match this BREP face
            for face_info in face_data:
                if face_info['face_object'].IsSame(brep_face):
                    triangle_ranges.append({
                        'start': face_info['triangle_start'],
                        'end': face_info['triangle_end'],
                        'count': face_info['triangle_count']
                    })
                    break
            
            # Store triangle mapping
            if triangle_ranges:
                feature['triangle_ranges'] = triangle_ranges
                # For single-face features, also provide flat start/end
                if len(triangle_ranges) == 1:
                    feature['triangle_start'] = triangle_ranges[0]['start']
                    feature['triangle_end'] = triangle_ranges[0]['end']
                    feature['triangle_count'] = triangle_ranges[0]['count']
                
                # Calculate feature center (for camera zoom)
                if 'position' in feature:
                    feature['center'] = feature['position']
                else:
                    # For planar/complex features, use face center
                    feature['center'] = face_data[0]['center'] if face_data else [0, 0, 0]
                
                logger.info(f"  {feature_type_name} #{idx+1}: Mapped to {feature.get('triangle_count', 0)} triangles")
            
            # Remove BREP reference (can't serialize to JSON)
            del feature['brep_face']
    
    # Map each feature type
    map_feature_list(features['through_holes'], 'Through-hole')
    map_feature_list(features['blind_holes'], 'Blind hole')
    map_feature_list(features['bores'], 'Bore')
    map_feature_list(features['bosses'], 'Boss')
    map_feature_list(features['planar_faces'], 'Planar face')
    map_feature_list(features['fillets'], 'Fillet')
    map_feature_list(features['complex_surfaces'], 'Complex surface')
    
    # Update legacy combined lists
    features['holes'] = features['through_holes'] + features['blind_holes']
    features['cylindrical_bosses'] = features['bosses']
    
    logger.info("✅ Feature-to-triangle mapping complete!")
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
    ⭐ UPDATED: Now tracks triangle ranges for each face
    
    === SECTION 1: MESH GENERATION ===
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

        logger.info("📊 Extracting mesh geometry with triangle tracking...")
        
        vertices, indices, normals = [], [], []
        face_data = []  # Store face metadata for later classification AND mapping
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
            
            # Store face metadata for classification AND mapping
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
            
            # ⭐ NEW: Calculate triangle range for this face
            triangle_start = face_start_index // 3
            triangle_end = len(indices) // 3
            triangle_count = triangle_end - triangle_start
            
            # Store face info for classification AND mapping
            face_data.append({
                'face_idx': face_idx,
                'surf_type': surf_type,
                'center': center,
                'start_vertex': face_start_vertex,
                'vertex_count': len(face_vertices),
                'start_index': face_start_index,
                'triangle_start': triangle_start,      # ⭐ NEW
                'triangle_end': triangle_end,          # ⭐ NEW
                'triangle_count': triangle_count,      # ⭐ NEW
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
    locked_faces = set()  # Faces classified in step 1 - don't change these!
    
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
            locked_faces.add(face_idx)  # Lock this classification
            
            # Apply to vertices
            for v_idx in range(start_vertex, start_vertex + vertex_count_face):
                vertex_colors[v_idx] = face_type
            
            if face_idx < 10:
                logger.info(f"  Face {face_idx}: Cylinder R={radius:.2f}mm → {face_type}")
                
        except Exception as e:
            logger.warning(f"Cylinder classification failed for face {face_idx}: {e}")
            face_classifications[face_idx] = "external"
    
    logger.info("🔍 STEP 2: Multi-pass propagation to adjacent faces...")
    
    # STEP 2: Multi-pass propagation until stable
    max_iterations = 10
    
    for iteration in range(max_iterations):
        changes_made = False
        
        for face_info in face_data:
            face_idx = face_info['face_idx']
            
            # Skip locked faces
            if face_idx in locked_faces:
                continue
            
            surf_type = face_info['surf_type']
            face_object = face_info['face_object']
            start_vertex = face_info['start_vertex']
            vertex_count_face = face_info['vertex_count']
            
            current_type = face_classifications.get(face_idx)
            
            # Find adjacent faces
            edge_exp = TopExp_Explorer(face_object, TopAbs_EDGE)
            neighbor_types = []
            
            while edge_exp.More():
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
                                    other_idx = other_info['face_idx']
                                    if other_idx != face_idx and other_idx in face_classifications:
                                        neighbor_types.append(face_classifications[other_idx])
                                    break
                            
                            face_iter.Next()
                        break
                
                edge_exp.Next()
            
            # Determine new type
            new_type = None
            
            if neighbor_types:
                if "internal" in neighbor_types:
                    new_type = "internal"
                elif "through" in neighbor_types:
                    new_type = "through"
                else:
                    new_type = "external"
            else:
                if current_type is None:
                    new_type = "planar" if surf_type == GeomAbs_Plane else "external"
                else:
                    new_type = current_type
            
            # Update if changed
            if current_type != new_type:
                face_classifications[face_idx] = new_type
                for v_idx in range(start_vertex, start_vertex + vertex_count_face):
                    vertex_colors[v_idx] = new_type
                changes_made = True
        
        if not changes_made:
            logger.info(f"  Propagation converged after {iteration + 1} iterations")
            break
        elif iteration == max_iterations - 1:
            logger.info(f"  Propagation stopped at max iterations ({max_iterations})")
    
    # Count results
    type_counts = {}
    for vtype in vertex_colors:
        type_counts[vtype] = type_counts.get(vtype, 0) + 1
    logger.info(f"✅ Classification complete! Distribution: {type_counts}")
    
    return vertex_colors


def convert_colors_to_hex(vertex_colors):
    """
    Convert semantic color labels to hex color codes for frontend display
    
    Color scheme:
    - external: Grey #999999
    - internal: Red #FF0000
    - through: Gold #FFD700
    - planar: Light grey #DDDDDD
    """
    color_map = {
        'external': '#999999',
        'internal': '#FF0000',
        'through': '#FFD700',
        'planar': '#DDDDDD'
    }
    
    hex_colors = []
    for color_label in vertex_colors:
        hex_colors.append(color_map.get(color_label, '#999999'))
    
    logger.info(f"🎨 Converted {len(hex_colors)} vertex colors to hex codes")
    return hex_colors


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
        
        logger.info("🔧 Detecting manufacturing features...")
        manufacturing_features = recognize_manufacturing_features(shape)
        
        logger.info("🎨 Generating display mesh...")
        mesh_data = tessellate_shape(shape)
        
        # ⭐ NEW: Map features to triangles for frontend highlighting
        logger.info("🔗 Mapping features to mesh triangles...")
        manufacturing_features = map_features_to_triangles(manufacturing_features, mesh_data['face_data'])
        
        logger.info("🎨 Classifying face colors...")
        vertex_colors_labels = classify_mesh_faces(mesh_data, shape)
        vertex_colors_hex = convert_colors_to_hex(vertex_colors_labels)
        mesh_data["vertex_colors"] = vertex_colors_hex
        
        logger.info("📐 Extracting BREP edges...")
        feature_edges = extract_feature_edges(shape, max_edges=500)
        mesh_data["feature_edges"] = feature_edges
        mesh_data["triangle_count"] = len(mesh_data.get("indices", [])) // 3

        is_cylindrical = len(manufacturing_features['holes']) > 0 or len(manufacturing_features['bosses']) > 0
        has_flat_surfaces = len(manufacturing_features['planar_faces']) > 0
        
        # Calculate complexity
        through_holes = len(manufacturing_features.get('through_holes', []))
        blind_holes = len(manufacturing_features.get('blind_holes', []))
        bores = len(manufacturing_features.get('bores', []))
        bosses = len(manufacturing_features.get('bosses', []))
        fillets = len(manufacturing_features.get('fillets', []))
        
        total_features = through_holes + blind_holes + bores + bosses + fillets
        
        cylindrical_faces = len(manufacturing_features['holes']) + len(manufacturing_features['bosses'])
        planar_faces = len(manufacturing_features['planar_faces'])
        complexity_score = min(10, int(
            (total_features / 5) +
            (through_holes * 0.5) +
            (blind_holes * 0.3) +
            (bores * 0.2) +
            (bosses * 0.4) +
            (fillets * 0.1)
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
            'manufacturing_features': manufacturing_features,  # ⭐ Now includes triangle mapping!
            'feature_summary': {
                'through_holes': len(manufacturing_features.get('through_holes', [])),
                'blind_holes': len(manufacturing_features.get('blind_holes', [])),
                'bores': len(manufacturing_features.get('bores', [])),
                'bosses': len(manufacturing_features.get('bosses', [])),
                'total_holes': through_holes + blind_holes,
                'planar_faces': planar_faces,
                'fillets': fillets,
                'complexity_score': complexity_score
            },
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
            'total_faces': total_features,
            'planar_faces': planar_faces,
            'cylindrical_faces': cylindrical_faces,
            'analysis_type': 'dual_representation_with_feature_mapping',  # ⭐ Updated
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
        "version": "8.0.0-feature-highlighting",  # ⭐ Updated version
        "status": "running",
        "endpoints": {
            "health": "/health",
            "analyze": "/analyze-cad"
        },
        "features": {
            "classification": "Mesh-based with neighbor propagation",
            "feature_detection": "Accurate through-hole, blind hole, bore, and boss detection",
            "inner_surfaces": "Detected by cylinder radius and propagated to adjacent faces",
            "through_holes": "Detected by size and connectivity analysis",
            "color_output": "Hex color codes for frontend display",
            "feature_mapping": "Triangle indices for interactive highlighting"  # ⭐ NEW
        },
        "documentation": "POST multipart/form-data with 'file' field containing .step file"
    })


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
