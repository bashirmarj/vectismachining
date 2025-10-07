-- Create status enum for quotations
CREATE TYPE quotation_status AS ENUM ('pending', 'reviewing', 'quoted', 'accepted', 'rejected', 'expired');

-- Expand quotation_submissions table
ALTER TABLE public.quotation_submissions
ADD COLUMN customer_name TEXT,
ADD COLUMN customer_company TEXT,
ADD COLUMN customer_phone TEXT,
ADD COLUMN shipping_address TEXT,
ADD COLUMN customer_message TEXT,
ADD COLUMN status quotation_status NOT NULL DEFAULT 'pending',
ADD COLUMN quote_number TEXT UNIQUE,
ADD COLUMN reviewed_by UUID REFERENCES public.profiles(id),
ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE;

-- Create quote_line_items table
CREATE TABLE public.quote_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID NOT NULL REFERENCES public.quotation_submissions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2),
  lead_time_days INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quotes table
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID NOT NULL UNIQUE REFERENCES public.quotation_submissions(id) ON DELETE CASCADE,
  quote_number TEXT NOT NULL UNIQUE,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  shipping_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  estimated_lead_time_days INTEGER,
  notes TEXT,
  valid_until DATE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quote_line_items
CREATE POLICY "Admins can view all quote line items"
ON public.quote_line_items
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert quote line items"
ON public.quote_line_items
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update quote line items"
ON public.quote_line_items
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete quote line items"
ON public.quote_line_items
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for quotes
CREATE POLICY "Admins can view all quotes"
ON public.quotes
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert quotes"
ON public.quotes
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update quotes"
ON public.quotes
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete quotes"
ON public.quotes
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to generate quote numbers
CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  year_prefix TEXT;
  next_number INTEGER;
  quote_num TEXT;
BEGIN
  year_prefix := 'Q' || TO_CHAR(NOW(), 'YYYY') || '-';
  
  -- Get the highest number for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_number
  FROM quotation_submissions
  WHERE quote_number LIKE year_prefix || '%';
  
  quote_num := year_prefix || LPAD(next_number::TEXT, 4, '0');
  
  RETURN quote_num;
END;
$$;

-- Trigger to auto-generate quote number
CREATE OR REPLACE FUNCTION public.set_quote_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quote_number IS NULL THEN
    NEW.quote_number := public.generate_quote_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_quote_number_trigger
BEFORE INSERT ON public.quotation_submissions
FOR EACH ROW
EXECUTE FUNCTION public.set_quote_number();

-- Add index for better query performance
CREATE INDEX idx_quote_line_items_quotation_id ON public.quote_line_items(quotation_id);
CREATE INDEX idx_quotes_quotation_id ON public.quotes(quotation_id);
CREATE INDEX idx_quotation_submissions_status ON public.quotation_submissions(status);
CREATE INDEX idx_quotation_submissions_quote_number ON public.quotation_submissions(quote_number);