-- Create table to store detected features
CREATE TABLE IF NOT EXISTS part_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid REFERENCES quotation_submissions(id) ON DELETE CASCADE,
  line_item_id uuid REFERENCES quote_line_items(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  feature_type text NOT NULL,
  orientation text,
  parameters jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_part_features_quotation ON part_features(quotation_id);
CREATE INDEX IF NOT EXISTS idx_part_features_line_item ON part_features(line_item_id);
CREATE INDEX IF NOT EXISTS idx_part_features_type ON part_features(feature_type);

-- Enable RLS
ALTER TABLE part_features ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view all part features"
  ON part_features FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert part features"
  ON part_features FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update part features"
  ON part_features FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete part features"
  ON part_features FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));