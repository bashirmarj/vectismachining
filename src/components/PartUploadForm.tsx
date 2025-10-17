import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileUploadScreen } from "./part-upload/FileUploadScreen";
import { PartConfigScreen } from "./part-upload/PartConfigScreen";

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
  meshId?: string;
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
    feature_tree?: {
      common_dimensions: Array<{
        label: string;
        value: number;
        unit: string;
      }>;
      oriented_sections: Array<{
        orientation: string;
        features: any[];
      }>;
    };
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
  const [currentScreen, setCurrentScreen] = useState<'upload' | 'configure'>('upload');
  const [files, setFiles] = useState<FileWithQuantity[]>([]);
  const [materials, setMaterials] = useState<string[]>([]);
  const [processes, setProcesses] = useState<string[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [rateLimitRemaining, setRateLimitRemaining] = useState<number | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const { toast } = useToast();

  // Load available materials and processes
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

  // Enable dev tools with Ctrl+Shift+D or Cmd+Shift+D
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        setShowDevTools(prev => !prev);
        toast({
          title: showDevTools ? '🛠️ Dev tools hidden' : '🛠️ Dev tools visible',
        });
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showDevTools, toast]);

  // Load rate limit state
  useEffect(() => {
    const stored = localStorage.getItem('quotation_rate_limit');
    if (stored) {
      const { expiry } = JSON.parse(stored);
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

  // Countdown timer
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

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const testFlaskConnection = async () => {
    setIsTestingConnection(true);
    
    try {
      console.log('🧪 Testing Flask backend connection...');
      
      const { data, error } = await supabase.functions.invoke('analyze-cad', {
        headers: {
          'x-test-flask': 'true'
        }
      });
      
      if (error) {
        console.error('❌ Connection test failed:', error);
        toast({
          title: "Flask Connection Failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      
      if (data.success) {
        console.log(`✅ Flask backend connected successfully (${data.latency}ms)`);
        toast({
          title: `✅ Flask Backend Connected (${data.latency}ms)`,
          description: 'Geometry service is operational',
        });
      } else {
        console.error('❌ Flask health check failed:', data.error);
        toast({
          title: "Flask Health Check Failed",
          description: data.error,
          variant: "destructive",
        });
      }
      
    } catch (error: any) {
      console.error('❌ Test request failed:', error);
      toast({
        title: "Connection Test Failed",
        description: error.message || 'Unable to reach Edge Function',
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const analyzeFile = async (fileWithQty: FileWithQuantity, index: number) => {
    try {
      setFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, isAnalyzing: true } : f
      ));

      const arrayBuffer = await fileWithQty.file.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);

      const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-cad', {
        body: {
          file_name: fileWithQty.file.name,
          file_size: fileWithQty.file.size,
          file_data: base64,
          quantity: fileWithQty.quantity,
          force_reanalyze: true
        }
      });

      if (analysisError) throw analysisError;

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
            processes: analysisData.recommended_processes,
            material: fileWithQty.material,
            finish: 'As-machined'
          }
        });

        if (quoteError) throw quoteError;
        quoteData = data;
      }

      setFiles(prev => prev.map((f, i) => 
        i === index ? { 
          ...f,
          meshId: analysisData.mesh_id,
          analysis: {
            volume_cm3: analysisData.volume_cm3,
            surface_area_cm2: analysisData.surface_area_cm2,
            complexity_score: analysisData.complexity_score,
            confidence: analysisData.confidence,
            method: analysisData.method,
            triangle_count: analysisData.triangle_count,
            detected_features: analysisData.detected_features,
            recommended_processes: analysisData.recommended_processes,
            feature_tree: analysisData.feature_tree
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
          description: "Select material to see pricing",
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const invalidFiles = selectedFiles.filter(file => {
      const fileName = file.name.toLowerCase();
      return !fileName.endsWith('.step') && !fileName.endsWith('.stp') && 
             !fileName.endsWith('.iges') && !fileName.endsWith('.igs');
    });

    if (invalidFiles.length > 0) {
      toast({
        title: "Invalid file type",
        description: "Only STEP and IGES files are supported",
        variant: "destructive",
      });
      return;
    }
    
    const filesWithQuantity = selectedFiles.map(file => ({ 
      file, 
      quantity: 1, 
      material: undefined, 
      process: undefined 
    }));
    
    const newFiles = [...files, ...filesWithQuantity];
    setFiles(newFiles);
    
    // Analyze each new file
    for (let idx = 0; idx < filesWithQuantity.length; idx++) {
      const fileIndex = files.length + idx;
      await analyzeFile(filesWithQuantity[idx], fileIndex);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    if (selectedFileIndex >= files.length - 1) {
      setSelectedFileIndex(Math.max(0, files.length - 2));
    }
  };

  const handleContinue = () => {
    setCurrentScreen('configure');
  };

  const handleBack = () => {
    setCurrentScreen('upload');
  };

  const handleUpdateFile = (index: number, updates: Partial<FileWithQuantity>) => {
    setFiles(prev => prev.map((item, i) => 
      i === index ? { ...item, ...updates } : item
    ));
    
    // Re-analyze if material changed
    if (updates.material) {
      const fileWithQty = files[index];
      if (fileWithQty && 
          !fileWithQty.isAnalyzing && 
          fileWithQty.analysis?.recommended_processes && 
          fileWithQty.analysis.recommended_processes.length > 0) {
        analyzeFile({ ...fileWithQty, ...updates }, index);
      }
    }
  };

  const handleSubmit = async (formData: any) => {
    if (isRateLimited) {
      toast({
        title: "Rate limit active",
        description: `Please wait ${Math.ceil((rateLimitRemaining || 0) / 60)} minutes before submitting again.`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Convert files to base64
      const filesData = await Promise.all(
        files.map(async (fileItem) => {
          const arrayBuffer = await fileItem.file.arrayBuffer();
          const base64 = arrayBufferToBase64(arrayBuffer);
          
          return {
            file_name: fileItem.file.name,
            file_size: fileItem.file.size,
            file_data: base64,
            quantity: fileItem.quantity,
            material: fileItem.material,
            process: fileItem.process,
            analysis: fileItem.analysis,
            quote: fileItem.quote,
            mesh_id: fileItem.meshId
          };
        })
      );

      const { data, error } = await supabase.functions.invoke('send-quotation-request', {
        body: {
          name: formData.name,
          company: formData.company,
          email: formData.email,
          phone: formData.phone,
          shipping_address: formData.address,
          message: formData.message,
          files: filesData,
          drawing_files: []
        }
      });

      if (error) throw error;

      if (data.rateLimitInfo) {
        const { waitTimeSeconds } = data.rateLimitInfo;
        const expiry = Date.now() + (waitTimeSeconds * 1000);
        localStorage.setItem('quotation_rate_limit', JSON.stringify({
          expiry,
          remainingSeconds: waitTimeSeconds
        }));
        setRateLimitRemaining(waitTimeSeconds);
        setIsRateLimited(true);
      }

      toast({
        title: "Quote Request Submitted!",
        description: "We'll review your parts and send you a detailed quote within 24 hours.",
      });

      // Reset form
      setFiles([]);
      setCurrentScreen('upload');
      setSelectedFileIndex(0);
    } catch (error: any) {
      console.error('Error submitting quote request:', error);
      toast({
        title: "Submission Failed",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const isAnalyzing = files.some(f => f.isAnalyzing);

  if (currentScreen === 'upload') {
    return (
      <FileUploadScreen
        files={files}
        onFileSelect={handleFileSelect}
        onRemoveFile={handleRemoveFile}
        onContinue={handleContinue}
        isAnalyzing={isAnalyzing}
        showDevTools={showDevTools}
        onTestConnection={testFlaskConnection}
        isTestingConnection={isTestingConnection}
      />
    );
  }

  return (
    <PartConfigScreen
      files={files}
      materials={materials}
      processes={processes}
      onBack={handleBack}
      onSubmit={handleSubmit}
      onUpdateFile={handleUpdateFile}
      selectedFileIndex={selectedFileIndex}
      onSelectFile={setSelectedFileIndex}
      isSubmitting={uploading}
    />
  );
};
