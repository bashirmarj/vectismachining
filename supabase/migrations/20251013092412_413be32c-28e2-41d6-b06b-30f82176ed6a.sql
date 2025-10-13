-- Add mesh_id column to quote_line_items to link to cad_meshes
ALTER TABLE quote_line_items 
ADD COLUMN mesh_id uuid REFERENCES cad_meshes(id);

-- Add index for better query performance
CREATE INDEX idx_quote_line_items_mesh_id ON quote_line_items(mesh_id);