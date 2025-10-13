FROM continuumio/miniconda3:latest

WORKDIR /app

# Install pythonOCC via conda (pre-compiled binaries, no building needed)
RUN conda install -c conda-forge pythonocc-core=7.7.2 -y && \
    conda clean -afy

# Copy requirements and install Flask dependencies via pip
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app.py .

# Expose port (Render provides $PORT dynamically)
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD python -c "import sys; sys.exit(0)"

# Run with gunicorn for production
CMD gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 120 --access-logfile - --error-logfile - app:app
