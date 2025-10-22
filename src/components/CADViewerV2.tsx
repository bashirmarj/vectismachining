import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Canvas3D from './cad-viewer-v2/Canvas3D';
import { Loader2 } from 'lucide-react';

export interface MeshData {
  vertices: number[];
  indices: number[];
  normals: number[];
  triangle_count: number;
  vertex_colors?: number[];
  feature_edges?: number[];
}

interface CADViewerProps {
  file?: File;
  fileUrl?: string;
  fileName?: string;
  meshId?: string;
  meshData?: MeshData;
  detectedFeatures?: any;
}

const CADViewerV2 = ({ 
  file, 
  fileUrl, 
  fileName, 
  meshId, 
  meshData: propMeshData,
  detectedFeatures 
}: CADViewerProps) => {
  const [meshData, setMeshData] = useState<MeshData | null>(propMeshData || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch mesh data from Supabase if meshId is provided
  useEffect(() => {
    if (meshId && !propMeshData) {
      const fetchMeshData = async () => {
        setLoading(true);
        setError(null);
        
        try {
          const { data, error: fetchError } = await supabase
            .from('cad_meshes')
            .select('*')
            .eq('id', meshId)
            .single();

          if (fetchError) throw fetchError;
          
          if (data) {
            setMeshData({
              vertices: Array.isArray(data.vertices) ? data.vertices.map(Number) : [],
              indices: Array.isArray(data.indices) ? data.indices.map(Number) : [],
              normals: Array.isArray(data.normals) ? data.normals.map(Number) : [],
              triangle_count: data.triangle_count,
              vertex_colors: data.vertex_colors && Array.isArray(data.vertex_colors) 
                ? data.vertex_colors.map(Number) 
                : undefined,
              feature_edges: data.feature_edges && Array.isArray(data.feature_edges)
                ? data.feature_edges.map(Number)
                : undefined
            });
          }
        } catch (err) {
          console.error('Error fetching mesh data:', err);
          setError('Failed to load 3D model');
        } finally {
          setLoading(false);
        }
      };

      fetchMeshData();
    } else if (propMeshData) {
      setMeshData(propMeshData);
    }
  }, [meshId, propMeshData]);

  const hasValidModel = meshData && meshData.vertices && meshData.vertices.length > 0;

  // Loading state
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading 3D model...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-destructive font-medium">{error}</p>
          <p className="text-sm text-muted-foreground mt-2">Please try uploading the file again</p>
        </div>
      </div>
    );
  }

  // No model state
  if (!hasValidModel) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">No 3D model loaded</p>
          <p className="text-sm text-muted-foreground mt-2">Upload a CAD file to view it here</p>
        </div>
      </div>
    );
  }

  // Main viewer
  return (
    <div className="w-full h-full relative bg-background">
      <Canvas3D 
        meshData={meshData} 
        detectedFeatures={detectedFeatures}
      />
    </div>
  );
};

export default CADViewerV2;
