# Mesh Service - High-Quality Adaptive Mesh Generation

A Python microservice that generates high-quality adaptive meshes from STEP files using Gmsh.

## Features

- **Adaptive Tessellation**: Different mesh densities for planar vs. curved surfaces
- **Quality Presets**: `fast`, `balanced`, `ultra` modes for different use cases
- **Smooth Normals**: Per-vertex normals for high-quality rendering
- **Optimized for Display**: Best-in-class visual quality for CAD viewers

## Deployment Options

### Railway

1. Create new project → Deploy from GitHub
2. Configure:
   - **Root Directory**: `mesh-service`
   - **Dockerfile Path**: `mesh-service/Dockerfile`
   - **Port**: `5001`
3. Deploy and copy the service URL

### Render

1. New Web Service → Connect repository
2. Configure:
   - **Name**: `mesh-service`
   - **Root Directory**: `mesh-service`
   - **Environment**: `Docker`
   - **Dockerfile Path**: `mesh-service/Dockerfile`
   - **Port**: `5001`
3. Deploy and copy the service URL

### DigitalOcean App Platform

1. Create App → GitHub repository
2. Configure Component:
   - **Type**: Web Service
   - **Source Directory**: `mesh-service`
   - **Dockerfile**: `mesh-service/Dockerfile`
   - **HTTP Port**: `5001`
3. Deploy and copy the service URL

### Docker (Local Testing)

```bash
cd mesh-service
docker build -t mesh-service .
docker run -p 5001:5001 mesh-service
```

## API Endpoints

### POST /mesh-cad
Generate high-quality adaptive mesh from STEP file.

**Request:**
```bash
curl -X POST http://localhost:5001/mesh-cad \
  -F "file=@part.step" \
  -F "quality=balanced"
```

**Quality Presets:**
- `fast`: Quick mesh generation, lower triangle count (~10k triangles)
- `balanced`: Good quality/performance balance (~20k triangles, default)
- `ultra`: Maximum quality for presentation (~40k+ triangles)

**Response:**
```json
{
  "vertices": [[x1,y1,z1], [x2,y2,z2], ...],
  "indices": [[i1,i2,i3], [i4,i5,i6], ...],
  "normals": [[nx1,ny1,nz1], [nx2,ny2,nz2], ...],
  "triangle_count": 18432,
  "quality_preset": "balanced"
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "mesh-service",
  "gmsh_available": true
}
```

## Technology Stack

- **Gmsh**: Industry-standard mesh generation
- **Flask**: Lightweight web framework
- **NumPy**: Numerical computations for normals
- **Conda**: Package management for Gmsh binaries

## Environment Variables

After deployment, add the service URL as `MESH_SERVICE_URL` secret to your edge function:

```bash
# In Supabase/Lovable Cloud
MESH_SERVICE_URL=https://your-mesh-service.onrender.com
```

## Architecture

This is **Service 2** in the dual-service architecture:

- **Service 1** (`geometry-service`): Feature analysis, routing, cost estimation
- **Service 2** (`mesh-service`): High-quality adaptive mesh generation

The edge function orchestrates both services in parallel for optimal performance.
