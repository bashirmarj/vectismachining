-- Allow anonymous users to read mesh data from cad_meshes table
CREATE POLICY "Allow anonymous read access to cad_meshes"
ON public.cad_meshes
FOR SELECT
TO anon
USING (true);