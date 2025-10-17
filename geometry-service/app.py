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
from OCC.Core.TopExp import TopExp_Explorer
from OCC.Core.TopLoc import TopLoc_Location
from OCC.Core.Bnd import Bnd_Box
from OCC.Core.BRepBndLib import brepbndlib, brepbndlib_Add
from OCC.Core.BRepAdaptor import BRepAdaptor_Surface, BRepAdaptor_Curve
from OCC.Core.GCPnts import GCPnts_UniformAbscissa
from OCC.Core.GeomAbs import GeomAbs_Cylinder, GeomAbs_Plane
from OCC.Core.TopoDS import topods_Edge as Edge, topods
from OCC.Core.GProp import GProp_GProps
from OCC.Core.BRepGProp import brepgprop_VolumeProperties, brepgprop_SurfaceProperties

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

def extract_feature_edges(shape, sample_density=2.0):
    """
    Extract all edges (internal + external) for 3D visualization outlines.
    sample_density: points per mm of arc length (default 2.0 = 1 point every 0.5mm)
    Adaptive sampling ensures large circles are as smooth as small fillets.
    """
    edges = []
    try:
        # Mesh first for better consistency
        BRepMesh_IncrementalMesh(shape, 0.1, True)

        exp = TopExp_Explorer(shape, TopAbs_EDGE)
        edge_count = 0
        total_samples = 0

        while exp.More():
            edge = Edge(exp.Current())
            adaptor = BRepAdaptor_Curve(edge)

            try:
                # Calculate edge length for adaptive sampling
                edge_length = adaptor.LastParameter() - adaptor.FirstParameter()
                
                # Adaptive sample count based on length
                # Minimum 10 samples for small features, more for large features
                sample_count = max(10, int(edge_length * sample_density))
                
                sampler = GCPnts_UniformAbscissa(adaptor, sample_count)
                if not sampler.IsDone():
                    exp.Next()
                    continue

                pts = []
                for i in range(1, sampler.NbPoints() + 1):
                    p = adaptor.Value(sampler.Parameter(i))
                    pts.append([
                        round(p.X(), 4),
                        round(p.Y(), 4),
                        round(p.Z(), 4)
                    ])

                if len(pts) >= 2:
                    edges.append(pts)
                    edge_count += 1
                    total_samples += len(pts)
            except Exception:
                pass  # skip problematic edges

            exp.Next()

        avg_samples = total_samples / edge_count if edge_count > 0 else 0
        logger.info(f"Extracted {edge_count} edges with adaptive sampling (avg {avg_samples:.1f} samples/edge, density={sample_density})")
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

def tessellate_shape(shape, quality=0.5):
    """Generate vertices, normals, indices, and classify faces"""
    try:
        deflection = 0.6 * (10 ** (-(quality * 3)))
        angular_deflection = 0.04
        mesh = BRepMesh_IncrementalMesh(shape, deflection, False, angular_deflection, True)
        mesh.Perform()
        if not mesh.IsDone():
            raise Exception("Mesh tessellation failed")

        bbox = Bnd_Box()
        brepbndlib.Add(shape, bbox)
        xmin, ymin, zmin, xmax, ymax, zmax = bbox.Get()
        cx, cy, cz = (xmin + xmax) / 2, (ymin + ymax) / 2, (zmin + zmax) / 2
        max_radius = max(xmax - xmin, ymax - ymin, zmax - zmin) / 2

        vertices, indices, normals, face_types = [], [], [], []
        vertex_map = {}
        current_index = 0
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

            # vertices
            face_vertices = []
            for i in range(1, triangulation.NbNodes() + 1):
                p = triangulation.Node(i)
                p.Transform(transform)
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
    """Upload a STEP file, mesh it, store in Supabase, return data"""
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

        # ✅ Allow frontend to control edge sampling
        quality = float(request.form.get("quality", 0.5))
        edge_density = int(request.form.get("edge_density", 10))

        mesh = tessellate_shape(shape, quality)
        mesh["feature_edges"] = extract_feature_edges(shape, sample_density=edge_density)
        mesh["triangle_count"] = len(mesh.get("indices", [])) // 3

        # Analyze shape geometry
        props = GProp_GProps()
        brepgprop_VolumeProperties(shape, props)
        volume_cm3 = props.Mass() / 1000  # mm³ to cm³

        # Surface area
        surface_props = GProp_GProps()
        brepgprop_SurfaceProperties(shape, surface_props)
        surface_area_cm2 = surface_props.Mass() / 100  # mm² to cm²

        # Detect cylindrical features
        is_cylindrical = False
        total_faces = 0
        planar_faces = 0
        cylindrical_faces = 0

        explorer = TopExp_Explorer(shape, TopAbs_FACE)
        while explorer.More():
            total_faces += 1
            face = topods.Face(explorer.Current())
            surface = BRep_Tool.Surface(face)
            
            surface_type = surface.DynamicType().Name()
            if 'Cylindrical' in surface_type:
                cylindrical_faces += 1
            elif 'Plane' in surface_type:
                planar_faces += 1
            
            explorer.Next()

        is_cylindrical = (cylindrical_faces / total_faces) > 0.5 if total_faces > 0 else False
        has_flat_surfaces = planar_faces > 0

        # Calculate complexity based on actual geometric features (independent of tessellation quality)
        complexity_score = min(10, int(
            (total_faces / 10) + 
            (cylindrical_faces * 0.2) + 
            (planar_faces * 0.1)
        ))

        # Get bounding box
        bbox = Bnd_Box()
        brepbndlib_Add(shape, bbox)
        xmin, ymin, zmin, xmax, ymax, zmax = bbox.Get()

        part_width_cm = (xmax - xmin) / 10
        part_height_cm = (ymax - ymin) / 10
        part_depth_cm = (zmax - zmin) / 10

        return jsonify({
            "status": "success",
            "volume_cm3": volume_cm3,
            "surface_area_cm2": surface_area_cm2,
            "complexity_score": complexity_score,
            "confidence": 0.9,
            "method": "opencascade",
            "part_width_cm": part_width_cm,
            "part_height_cm": part_height_cm,
            "part_depth_cm": part_depth_cm,
            "is_cylindrical": is_cylindrical,
            "total_faces": total_faces,
            "planar_faces": planar_faces,
            "cylindrical_faces": cylindrical_faces,
            "has_flat_surfaces": has_flat_surfaces,
            "mesh_data": mesh,
            "detected_features": {
                "holes": [],
                "grooves": [],
                "flat_surfaces": [],
                "primary_dimensions": {
                    "length_mm": part_depth_cm * 10,
                    "primary_axis": "Z"
                }
            }
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
