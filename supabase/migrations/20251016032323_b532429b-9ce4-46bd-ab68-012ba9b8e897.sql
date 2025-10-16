-- Add feature_edges column to cad_meshes table for clean wireframe rendering
ALTER TABLE cad_meshes
ADD COLUMN feature_edges jsonb DEFAULT '[]'::jsonb;

-- Add index for performance
CREATE INDEX idx_cad_meshes_feature_edges ON cad_meshes USING gin (feature_edges);

-- Update comment
COMMENT ON COLUMN cad_meshes.feature_edges IS 'Array of feature edge polylines from CAD geometry: [[[x,y,z], ...], ...]';