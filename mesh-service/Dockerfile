# ---------- High-Quality Mesh Service (Gmsh) ----------
FROM continuumio/miniconda3:24.7.1-0

WORKDIR /app
COPY requirements.txt .
COPY mesh_service.py .

# Install dependencies via pip (more reliable in containers)
RUN pip install --no-cache-dir -r requirements.txt gmsh numpy

EXPOSE 5001
CMD ["python", "mesh_service.py"]
