-- Update quote number generation to use MMYY format (e.g., Q1025-0001 for October 2025)
CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  month_year_prefix TEXT;
  next_number INTEGER;
  quote_num TEXT;
BEGIN
  -- Use MMYY format (e.g., 1025 for October 2025)
  month_year_prefix := 'Q' || TO_CHAR(NOW(), 'MMYY') || '-';
  
  -- Get the highest number for this month/year combination
  SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_number
  FROM quotation_submissions
  WHERE quote_number LIKE month_year_prefix || '%';
  
  quote_num := month_year_prefix || LPAD(next_number::TEXT, 4, '0');
  
  RETURN quote_num;
END;
$$;