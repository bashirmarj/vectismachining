-- Create table to track quotation submissions for rate limiting
CREATE TABLE IF NOT EXISTS public.quotation_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  email text NOT NULL,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indices for fast lookups
CREATE INDEX IF NOT EXISTS idx_quotation_submissions_ip_hash ON public.quotation_submissions(ip_hash);
CREATE INDEX IF NOT EXISTS idx_quotation_submissions_submitted_at ON public.quotation_submissions(submitted_at);

-- Enable RLS (edge function uses service role, so no policies needed)
ALTER TABLE public.quotation_submissions ENABLE ROW LEVEL SECURITY;