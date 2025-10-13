import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, File, CheckCircle2, AlertCircle, ChevronsUpDown, Check, Zap, Info, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

const countryCodes = [
  { code: "+1", country: "Canada" },
  { code: "+1", country: "United States" },
  { code: "+44", country: "United Kingdom" },
  { code: "+91", country: "India" },
  { code: "+86", country: "China" },
  { code: "+81", country: "Japan" },
  { code: "+49", country: "Germany" },
  { code: "+33", country: "France" },
  { code: "+39", country: "Italy" },
  { code: "+34", country: "Spain" },
  { code: "+61", country: "Australia" },
  { code: "+55", country: "Brazil" },
  { code: "+52", country: "Mexico" },
  { code: "+7", country: "Russia" },
  { code: "+82", country: "South Korea" },
  { code: "+971", country: "UAE" },
  { code: "+966", country: "Saudi Arabia" },
  { code: "+27", country: "South Africa" },
  { code: "+20", country: "Egypt" },
  { code: "+234", country: "Nigeria" },
  { code: "+254", country: "Kenya" },
].sort((a, b) => a.country.localeCompare(b.country));

interface FileWithQuantity {
  file: File;
  quantity: number;
  material?: string;
  process?: string;
  analysis?: {
    volume_cm3: number;
    surface_area_cm2: number;
    complexity_score: number;
    confidence?: number;
    method?: string;
    triangle_count?: number;
    detected_features?: {
      is_cylindrical: boolean;
      has_keyway: boolean;
      has_flat_surfaces: boolean;
      has_internal_holes: boolean;
      requires_precision_boring: boolean;
    };
    recommended_processes?: string[];
  };
  quote?: {
    unit_price: number;
    total_price: number;
    breakdown: {
      material_cost: number;
      machining_cost: number;
      setup_cost: number;
      finish_cost: number;
      surface_treatment_cost: number;
      discount_applied: string;
    };
    lead_time_days: number;
    process_breakdown?: Array<{
      process: string;
      machining_cost: number;
      setup_cost: number;
      estimated_hours: number;
    }>;
  };
  isAnalyzing?: boolean;
}

export const PartUploadForm = () => {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<FileWithQuantity[]>([]);
  const [drawingFiles, setDrawingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [materialOpen, setMaterialOpen] = useState<number | null>(null);
  const [processOpen, setProcessOpen] = useState<number | null>(null);
  const [materials, setMaterials] = useState<string[]>([]);
  const [processes, setProcesses] = useState<string[]>([]);
  const [rateLimitRemaining, setRateLimitRemaining] = useState<number | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const { toast } = useToast();

  // Load available materials and processes on mount
  useEffect(() => {
    const fetchMaterials = async () => {
      const { data } = await supabase
        .from('material_costs')
        .select('material_name')
        .eq('is_active', true)
        .order('material_name');
      
      if (data) {
        setMaterials(data.map(m => m.material_name));
      }
    };

    const fetchProcesses = async () => {
      const { data } = await supabase
        .from('manufacturing_processes')
        .select('name')
        .eq('is_active', true)
        .order('name');
      
      if (data) {
        setProcesses(data.map(p => p.name));
      }
    };

    fetchMaterials();
    fetchProcesses();
  }, []);

  // Load rate limit state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('quotation_rate_limit');
    if (stored) {
      const { expiry, remainingSeconds } = JSON.parse(stored);
      const now = Date.now();
      
      if (now < expiry) {
        const actualRemaining = Math.ceil((expiry - now) / 1000);
        setRateLimitRemaining(actualRemaining);
        setIsRateLimited(true);
      } else {
        localStorage.removeItem('quotation_rate_limit');
      }
    }
  }, []);

  // Countdown timer for rate limit
  useEffect(() => {
    if (rateLimitRemaining === null || rateLimitRemaining <= 0) {
      setIsRateLimited(false);
      setRateLimitRemaining(null);
      localStorage.removeItem('quotation_rate_limit');
      return;
    }

    const interval = setInterval(() => {
      setRateLimitRemaining(prev => {
        if (prev === null || prev <= 1) {
          setIsRateLimited(false);
          localStorage.removeItem('quotation_rate_limit');
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [rateLimitRemaining]);

  const analyzeFile = async (fileWithQty: FileWithQuantity, index: number) => {
    try {
      // Mark as analyzing
      setFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, isAnalyzing: true } : f
      ));

      const isSTL = fileWithQty.file.name.toLowerCase().endsWith('.stl');
      let analysisData;

      // For STL files, send the actual file for real geometry analysis
      if (isSTL) {
        const formData = new FormData();
        formData.append('file', fileWithQty.file);
        formData.append('file_name', fileWithQty.file.name);
        formData.append('quantity', fileWithQty.quantity.toString());

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-cad`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: formData,
          }
        );

        if (!response.ok) throw new Error('Analysis failed');
        analysisData = await response.json();
      } else {
        // For other formats, use metadata-only analysis
        const { data, error: analysisError } = await supabase.functions.invoke('analyze-cad', {
          body: {
            file_name: fileWithQty.file.name,
            file_size: fileWithQty.file.size,
            quantity: fileWithQty.quantity
          }
        });

        if (analysisError) throw analysisError;
        analysisData = data;
      }

      // Call pricing calculator if material is selected AND processes were detected
      let quoteData = null;
      if (fileWithQty.material && analysisData.recommended_processes && analysisData.recommended_processes.length > 0) {
        const { data, error: quoteError } = await supabase.functions.invoke('calculate-preliminary-quote', {
          body: {
            volume_cm3: analysisData.volume_cm3,
            surface_area_cm2: analysisData.surface_area_cm2,
            complexity_score: analysisData.complexity_score,
            part_width_cm: analysisData.part_width_cm,
            part_height_cm: analysisData.part_height_cm,
            part_depth_cm: analysisData.part_depth_cm,
            quantity: fileWithQty.quantity,
            processes: analysisData.recommended_processes, // Pass all detected processes
            material: fileWithQty.material,
            finish: 'As-machined'
          }
        });

        if (quoteError) throw quoteError;
        quoteData = data;
      }

      // Update file with analysis and quote
      setFiles(prev => prev.map((f, i) => 
        i === index ? { 
          ...f, 
          analysis: {
            volume_cm3: analysisData.volume_cm3,
            surface_area_cm2: analysisData.surface_area_cm2,
            complexity_score: analysisData.complexity_score,
            confidence: analysisData.confidence,
            method: analysisData.method,
            triangle_count: analysisData.triangle_count,
            detected_features: analysisData.detected_features,
            recommended_processes: analysisData.recommended_processes
          },
          quote: quoteData,
          isAnalyzing: false 
        } : f
      ));

      if (quoteData) {
        const confidenceText = analysisData.confidence >= 0.85 ? 'Real geometry analyzed' : 'Estimated from file';
        toast({
          title: "Analysis Complete",
          description: `${confidenceText} • Preliminary quote: $${quoteData.unit_price.toFixed(2)}/unit`,
        });
      } else {
        toast({
          title: "CAD Analysis Complete",
          description: "Select material and process to see pricing",
        });
      }
    } catch (error: any) {
      console.error('Error analyzing file:', error);
      setFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, isAnalyzing: false } : f
      ));
      toast({
        title: "Analysis Failed",
        description: "Could not generate preliminary quote. You can still submit your request.",
        variant: "destructive",
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      const validExtensions = [
        '.step', '.stp', '.iges', '.igs', '.stl', '.obj',
        '.sldprt', '.sldasm', '.slddrw',
        '.ipt', '.iam', '.idw',
        '.catpart', '.catproduct',
        '.x_t', '.x_b', '.prt', '.asm',
        '.pdf'
      ];
      
      const invalidFiles = selectedFiles.filter(file => {
        const fileName = file.name.toLowerCase();
        return !validExtensions.some(ext => fileName.endsWith(ext));
      });

      if (invalidFiles.length > 0) {
        toast({
          title: "Invalid file type",
          description: `${invalidFiles.length} file(s) have unsupported formats`,
          variant: "destructive",
        });
        return;
      }
      
      const filesWithQuantity = selectedFiles.map(file => ({ file, quantity: 1, material: undefined, process: undefined }));
      const newFiles = [...files, ...filesWithQuantity];
      setFiles(newFiles);
      
      // Analyze each new file
      filesWithQuantity.forEach((fileWithQty, idx) => {
        const fileIndex = files.length + idx;
        analyzeFile(fileWithQty, fileIndex);
      });
    }
  };

  const handleDrawingFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      const invalidFiles = selectedFiles.filter(file => {
        const fileName = file.name.toLowerCase();
        return !fileName.endsWith('.dwg') && !fileName.endsWith('.dxf') && !fileName.endsWith('.pdf');
      });

      if (invalidFiles.length > 0) {
        toast({
          title: "Invalid file type",
          description: `${invalidFiles.length} file(s) must be DWG, DXF, or PDF format`,
          variant: "destructive",
        });
        return;
      }
      
      setDrawingFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const updateFileQuantity = (index: number, quantity: number) => {
    const newQuantity = Math.max(1, quantity);
    setFiles(prev => prev.map((item, i) => 
      i === index ? { ...item, quantity: newQuantity } : item
    ));
    
    // Re-analyze with new quantity if both material and process selected
    const fileWithQty = files[index];
    if (fileWithQty && !fileWithQty.isAnalyzing && fileWithQty.material && fileWithQty.process) {
      analyzeFile({ ...fileWithQty, quantity: newQuantity }, index);
    }
  };

  const updateFileMaterial = (index: number, material: string) => {
    setFiles(prev => prev.map((item, i) => 
      i === index ? { ...item, material } : item
    ));
    
    // Re-analyze if processes have been detected
    const fileWithQty = files[index];
    if (fileWithQty && 
        !fileWithQty.isAnalyzing && 
        fileWithQty.analysis?.recommended_processes && 
        fileWithQty.analysis.recommended_processes.length > 0) {
      analyzeFile({ ...fileWithQty, material }, index);
    }
  };

  const removeDrawingFile = (index: number) => {
    setDrawingFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Helper function to convert ArrayBuffer to base64 in chunks to avoid call stack overflow
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 8192;
    let binary = '';
    
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binary);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (files.length === 0 || !email || !name || !phoneNumber || !shippingAddress) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields and upload at least one CAD file",
        variant: "destructive",
      });
      return;
    }

    // Check total file size (Resend has 40MB limit for attachments)
    const totalSize = files.reduce((sum, f) => sum + f.file.size, 0) + 
                      drawingFiles.reduce((sum, f) => sum + f.size, 0);
    const totalSizeMB = totalSize / 1024 / 1024;
    
    console.log(`Total file size: ${totalSizeMB.toFixed(2)} MB`);
    
    if (totalSizeMB > 35) {
      toast({
        title: "Files too large",
        description: `Total file size (${totalSizeMB.toFixed(1)}MB) exceeds the 35MB limit. Please reduce file sizes or upload fewer files.`,
        variant: "destructive",
        duration: 8000,
      });
      return;
    }

    setUploading(true);

    try {
      console.log('Converting files to base64...', files.length, 'CAD files,', drawingFiles.length, 'drawing files');
      
      // Convert files to base64 for sending to edge function
      const filePromises = files.map(async (fileWithQty) => {
        const arrayBuffer = await fileWithQty.file.arrayBuffer();
        const base64 = arrayBufferToBase64(arrayBuffer);
        return {
          name: fileWithQty.file.name,
          content: base64,
          size: fileWithQty.file.size,
          quantity: fileWithQty.quantity
        };
      });

      const drawingFilePromises = drawingFiles.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = arrayBufferToBase64(arrayBuffer);
        return {
          name: file.name,
          content: base64,
          size: file.size
        };
      });

      const uploadedFiles = await Promise.all(filePromises);
      const uploadedDrawingFiles = await Promise.all(drawingFilePromises);

      console.log('Files converted. Calling edge function...');
      console.log('Sending quotation request with', uploadedFiles.length, 'files');

      const response = await supabase.functions.invoke(
        'send-quotation-request',
        {
          body: {
            name,
            company,
            email,
            phone: `${countryCode} ${phoneNumber}`,
            shippingAddress,
            message,
            files: uploadedFiles,
            drawingFiles: uploadedDrawingFiles,
          },
        }
      );

      console.log('Response received:', response);
      console.log('Response error:', response.error);
      console.log('Response data:', response.data);

      // When Supabase functions return non-200 status, error details are in response.data
      const responseData = response.data;
      const hasError = response.error || (responseData && responseData.error);
      
      if (hasError) {
        // Check for rate limit error
        if (responseData && responseData.error === 'rate_limit_exceeded') {
          const remainingSeconds = responseData.remainingSeconds || 300;
          
          // Store in localStorage for persistence
          const expiry = Date.now() + (remainingSeconds * 1000);
          localStorage.setItem('quotation_rate_limit', JSON.stringify({
            expiry,
            remainingSeconds
          }));
          
          setRateLimitRemaining(remainingSeconds);
          setIsRateLimited(true);

          const minutes = Math.floor(remainingSeconds / 60);
          const seconds = remainingSeconds % 60;
          
          toast({
            title: "⏱️ Rate Limit Exceeded",
            description: `You've recently submitted a request. Please wait ${minutes} minute${minutes !== 1 ? 's' : ''} ${seconds} second${seconds !== 1 ? 's' : ''} before submitting another.`,
            variant: "destructive",
            duration: 10000,
          });
          
          setUploading(false);
          return;
        }
        
        // Check for file size error
        if (responseData && responseData.error === 'file_size_exceeded') {
          toast({
            title: "Files too large",
            description: `Total file size (${responseData.totalSizeMB?.toFixed(1)}MB) exceeds the limit. Please reduce file sizes.`,
            variant: "destructive",
            duration: 8000,
          });
          setUploading(false);
          return;
        }
        
        // Generic error
        throw new Error(responseData?.message || response.error?.message || 'Unknown error occurred');
      }

      const quoteNumber = response.data?.quoteNumber;

      toast({
        title: "✅ Success!",
        description: quoteNumber 
          ? `Your quotation request has been submitted with reference number: ${quoteNumber}. We'll contact you soon.`
          : "Your quotation request has been submitted. We'll contact you soon.",
        duration: 8000,
      });

      // Reset form
      setName("");
      setCompany("");
      setEmail("");
      setCountryCode("+1");
      setPhoneNumber("");
      setShippingAddress("");
      setMessage("");
      setFiles([]);
      setDrawingFiles([]);
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      const drawingInput = document.getElementById('drawing-upload') as HTMLInputElement;
      if (drawingInput) drawingInput.value = '';

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to submit quotation request. Please try again.",
        variant: "destructive",
        duration: 8000,
      });
    } finally {
      setUploading(false);
    }
  };

  const formatTimeRemaining = () => {
    if (!rateLimitRemaining) return '';
    const minutes = Math.floor(rateLimitRemaining / 60);
    const seconds = rateLimitRemaining % 60;
    return `${minutes}m ${seconds}s`;
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardContent className="p-6">
          <div className="mb-6">
          <h3 className="text-2xl font-bold mb-2">Request a Quotation</h3>
          <p className="text-muted-foreground">
            Upload your CAD file in any major format (STEP, SolidWorks, Inventor, CATIA, etc.) and optionally include a drawing file (DWG/DXF) for a detailed manufacturing quote.
          </p>
        </div>

        {isRateLimited && rateLimitRemaining && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive rounded-lg">
            <p className="text-sm font-medium text-destructive">
              ⏱️ Please wait {formatTimeRemaining()} before submitting another request.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Company Name</Label>
              <Input
                id="company"
                type="text"
                placeholder="Your Company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number *</Label>
            <div className="flex gap-2">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-[140px] justify-between"
                  >
                    {countryCode}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Search country..." />
                    <CommandList>
                      <CommandEmpty>No country found.</CommandEmpty>
                      <CommandGroup>
                        {countryCodes.map((item) => (
                          <CommandItem
                            key={item.code}
                            value={`${item.country} ${item.code}`}
                            onSelect={() => {
                              setCountryCode(item.code);
                              setOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                countryCode === item.code ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {item.code} - {item.country}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Input
                id="phone"
                type="tel"
                placeholder="1234567890"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="flex-1"
                required
              />
          </div>


          <div className="space-y-2">
            <Label htmlFor="message">Additional Instructions (Optional)</Label>
            <Textarea
              id="message"
              placeholder="Any special requirements or instructions for your parts..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Shipping Address *</Label>
            <Textarea
              id="address"
              placeholder="Enter your full shipping address"
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              rows={3}
              required
            />
          </div>


          <div className="space-y-2">
            <Label htmlFor="file-upload">CAD Files * (Multiple files supported)</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors">
              <input
                id="file-upload"
                type="file"
                multiple
                accept=".step,.stp,.iges,.igs,.stl,.obj,.sldprt,.sldasm,.slddrw,.ipt,.iam,.idw,.catpart,.catproduct,.x_t,.x_b,.prt,.asm,.pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                 {files.length > 0 ? (
                  <div className="w-full space-y-3">
                    {files.map((fileWithQty, index) => (
                      <div key={index} className="space-y-2">
                         <div className="p-3 bg-primary/5 rounded space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1">
                              <File className="h-6 w-6 text-primary flex-shrink-0" />
                              <div className="text-left flex-1">
                                <p className="font-medium text-sm">{fileWithQty.file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {(fileWithQty.file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`qty-${index}`} className="text-xs whitespace-nowrap">Qty:</Label>
                                <Input
                                  id={`qty-${index}`}
                                  type="number"
                                  min="1"
                                  value={fileWithQty.quantity}
                                  onChange={(e) => updateFileQuantity(index, parseInt(e.target.value) || 1)}
                                  className="w-20 h-8"
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  removeFile(index);
                                }}
                                className="h-8 w-8 p-0"
                              >
                                ×
                              </Button>
                            </div>
                          </div>
                          
                          {/* Material Selection */}
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`material-${index}`} className="text-xs whitespace-nowrap">Material: *</Label>
                            <Popover open={materialOpen === index} onOpenChange={(open) => setMaterialOpen(open ? index : null)}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={materialOpen === index}
                                  className="flex-1 justify-between h-8 text-xs"
                                >
                                  {fileWithQty.material || "Select material"}
                                  <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[300px] p-0 bg-background z-50">
                                <Command>
                                  <CommandInput placeholder="Search material..." className="h-9" />
                                  <CommandList>
                                    <CommandEmpty>No material found.</CommandEmpty>
                                    <CommandGroup>
                                      {materials.map((material) => (
                                        <CommandItem
                                          key={material}
                                          value={material}
                                          onSelect={() => {
                                            updateFileMaterial(index, material);
                                            setMaterialOpen(null);
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              fileWithQty.material === material ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          {material}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>

                          {/* Detected Processes (Read-only) */}
                          {fileWithQty.analysis?.recommended_processes && fileWithQty.analysis.recommended_processes.length > 0 && (
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Detected Manufacturing Processes:</Label>
                              <div className="flex flex-wrap gap-1.5">
                                {fileWithQty.analysis.recommended_processes.map((process, pIdx) => (
                                  <Badge 
                                    key={pIdx} 
                                    variant="secondary"
                                    className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200"
                                  >
                                    {process}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Instant Quote Preview */}
                        {fileWithQty.isAnalyzing && (
                          <Card className="border-blue-500/50">
                            <CardContent className="pt-4">
                              <div className="flex items-center gap-2 text-blue-600">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-sm">Analyzing CAD file...</span>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                        
                        {fileWithQty.quote && !fileWithQty.isAnalyzing && (
                          <Card className="border-blue-500">
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center justify-between text-base">
                                <div className="flex items-center gap-2">
                                  <Zap className="h-4 w-4 text-blue-500" />
                                  Preliminary Estimate
                                </div>
                                {fileWithQty.analysis && (
                                  <span className={`text-xs px-2 py-1 rounded ${
                                    (fileWithQty.analysis.confidence || 0) >= 0.85 
                                      ? 'bg-green-100 text-green-700' 
                                      : 'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {(fileWithQty.analysis.confidence || 0) >= 0.85 
                                      ? '✓ Real geometry' 
                                      : '⚠ Estimated'}
                                  </span>
                                )}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {fileWithQty.analysis?.triangle_count && (
                                <div className="text-xs text-muted-foreground border-b pb-2">
                                  <span>STL Analysis: {fileWithQty.analysis.triangle_count.toLocaleString()} triangles • {(fileWithQty.analysis.confidence! * 100).toFixed(0)}% confidence</span>
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs text-muted-foreground">Unit Price</Label>
                                  <p className="text-2xl font-bold text-blue-600">
                                    ${fileWithQty.quote.unit_price.toFixed(2)}
                                  </p>
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">Lead Time</Label>
                                  <p className="text-2xl font-bold">
                                    {fileWithQty.quote.lead_time_days} days
                                  </p>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs text-muted-foreground">Total for {fileWithQty.quantity} units</Label>
                                  <p className="text-lg font-semibold">
                                    ${fileWithQty.quote.total_price.toFixed(2)}
                                  </p>
                                </div>
                                {fileWithQty.quote.breakdown.discount_applied !== 'None' && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Discount Applied</Label>
                                    <p className="text-lg font-semibold text-green-600">
                                      {fileWithQty.quote.breakdown.discount_applied}
                                    </p>
                                  </div>
                                )}
                              </div>
                              
                              <Separator />
                              
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Material:</span>
                                  <span className="font-mono">${fileWithQty.quote.breakdown.material_cost.toFixed(2)}</span>
                                </div>
                                
                                {/* Show process breakdown if multiple processes */}
                                {fileWithQty.quote.process_breakdown && fileWithQty.quote.process_breakdown.length > 1 ? (
                                  <div className="space-y-1 pl-2 border-l-2 border-blue-200">
                                    <div className="text-xs font-medium text-muted-foreground">Manufacturing Processes:</div>
                                    {fileWithQty.quote.process_breakdown.map((pb: any, pbIdx: number) => (
                                      <div key={pbIdx} className="space-y-0.5">
                                        <div className="flex justify-between items-center">
                                          <span className="text-blue-600 font-medium">{pb.process}</span>
                                          <span className="font-mono text-xs">{pb.estimated_hours.toFixed(2)} hrs</span>
                                        </div>
                                        <div className="flex justify-between pl-3">
                                          <span className="text-muted-foreground">• Machining:</span>
                                          <span className="font-mono">${pb.machining_cost.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between pl-3">
                                          <span className="text-muted-foreground">• Setup:</span>
                                          <span className="font-mono">${pb.setup_cost.toFixed(2)}</span>
                                        </div>
                                      </div>
                                    ))}
                                    <Separator className="my-1" />
                                    <div className="flex justify-between font-medium">
                                      <span className="text-muted-foreground">Total Machining:</span>
                                      <span className="font-mono">${fileWithQty.quote.breakdown.machining_cost.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between font-medium">
                                      <span className="text-muted-foreground">Total Setup:</span>
                                      <span className="font-mono">${fileWithQty.quote.breakdown.setup_cost.toFixed(2)}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Machining:</span>
                                      <span className="font-mono">${fileWithQty.quote.breakdown.machining_cost.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Setup (amortized):</span>
                                      <span className="font-mono">${fileWithQty.quote.breakdown.setup_cost.toFixed(2)}</span>
                                    </div>
                                  </>
                                )}
                                
                                {fileWithQty.quote.breakdown.finish_cost > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Finish:</span>
                                    <span className="font-mono">${fileWithQty.quote.breakdown.finish_cost.toFixed(2)}</span>
                                  </div>
                                )}
                              </div>
                              
                              <Alert className="bg-blue-50 border-blue-200">
                                <Info className="h-3 w-3" />
                                <AlertDescription className="text-xs">
                                  Preliminary estimate • Final pricing subject to engineering review
                                </AlertDescription>
                              </Alert>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center justify-center gap-2 text-primary pt-2">
                      <Upload className="h-5 w-5" />
                      <span className="text-sm">Click to add more files</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium mb-1">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">
                      STEP, IGES, STL, SolidWorks, Inventor, CATIA, and more
                    </p>
                  </>
                )}
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="drawing-upload">Drawing Files (Optional - Multiple files supported)</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors">
              <input
                id="drawing-upload"
                type="file"
                multiple
                accept=".dwg,.dxf,.pdf"
                onChange={handleDrawingFileChange}
                className="hidden"
              />
              <label
                htmlFor="drawing-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                {drawingFiles.length > 0 ? (
                  <div className="w-full space-y-2">
                    {drawingFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between gap-3 p-2 bg-primary/5 rounded">
                        <div className="flex items-center gap-3">
                          <File className="h-6 w-6 text-primary flex-shrink-0" />
                          <div className="text-left">
                            <p className="font-medium text-sm">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            removeDrawingFile(index);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                    <div className="flex items-center justify-center gap-2 text-primary pt-2">
                      <Upload className="h-5 w-5" />
                      <span className="text-sm">Click to add more drawing files</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium mb-1">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">
                      DWG or DXF files only (optional)
                    </p>
                  </>
                )}
              </label>
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={uploading || isRateLimited}>
            {uploading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                Uploading {files.length + drawingFiles.length} file(s)...
              </div>
            ) : isRateLimited ? (
              <>⏱️ Please wait {formatTimeRemaining()}</>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Submit Quotation Request
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
