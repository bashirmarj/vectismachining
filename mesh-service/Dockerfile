# ---------- High-Quality Mesh Service (Gmsh) ----------
FROM continuumio/miniconda3:24.7.1-0

WORKDIR /app
COPY requirements.txt .
COPY mesh_service.py .

# Install Gmsh and dependencies from conda-forge (precompiled)
RUN conda install -y -c conda-forge gmsh numpy && \
    pip install --no-cache-dir -r requirements.txt && \
    conda clean --all --yes

EXPOSE 5001
CMD ["python", "mesh_service.py"]
