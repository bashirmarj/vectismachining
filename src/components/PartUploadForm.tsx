import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileUploadScreen } from "./part-upload/FileUploadScreen";
import { PartConfigScreen } from "./part-upload/PartConfigScreen";

// Using Supabase Edge Function proxy for Flask backend (handles cold starts & retries)

interface FileWithQuantity {
  file: File;
  quantity: number;
  material?: string;
  process?: string;
  meshId?: string;
  meshData?: {
    vertices: number[];
    indices: number[];
    normals: number[];
    triangle_count: number;
    face_types?: string[];
    feature_edges?: number[][][];
  };
  analysis?: {
    volume_cm3?: number;
    surface_area_cm2?: number;
    complexity_score?: number;
    confidence?: number;
    method?: string;
    triangle_count?: number;
    detected_features?: Record<string, boolean>;
    recommended_processes?: string[];
  };
  quote?: any;
  isAnalyzing?: boolean;
}

export const PartUploadForm = () => {
  const [currentScreen, setCurrentScreen] = useState<'upload' | 'configure'>('upload');
  const [files, setFiles] = useState<FileWithQuantity[]>([]);
  const [materials, setMaterials] = useState<string[]>([]);
  const [processes, setProcesses] = useState<string[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const { toast } = useToast();

  // Load materials & processes from Supabase
  useEffect(() => {
    const fetchMaterials = async () => {
      const { data } = await supabase
        .from("material_costs")
        .select("material_name")
        .eq("is_active", true)
        .order("material_name");
      if (data) setMaterials(data.map((m) => m.material_name));
    };

    const fetchProcesses = async () => {
      const { data } = await supabase
        .from("manufacturing_processes")
        .select("name")
        .eq("is_active", true)
        .order("name");
      if (data) setProcesses(data.map((p) => p.name));
    };

    fetchMaterials();
    fetchProcesses();
  }, []);

  // 🔧 Test backend connection via edge function
  const testFlaskConnection = async () => {
    setIsTestingConnection(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-cad', {
        body: { test: true }
      });
      if (error) throw error;
      toast({
        title: "✅ Backend Connection Successful",
        description: "Geometry service is ready",
      });
    } catch (error: any) {
      toast({
        title: "❌ Backend Connection Failed",
        description: error.message || "Unable to reach backend",
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  // 🧠 Analyze file using Supabase Edge Function (handles cold starts)
  const analyzeFile = async (fileWithQty: FileWithQuantity, index: number) => {
    try {
      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, isAnalyzing: true } : f))
      );

      // Convert file to base64
      const fileBuffer = await fileWithQty.file.arrayBuffer();
      const base64File = btoa(
        new Uint8Array(fileBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      console.log(`📤 Sending ${fileWithQty.file.name} to edge function (may take 30-60s on first use)...`);

      const { data: result, error } = await supabase.functions.invoke('analyze-cad', {
        body: {
          file_name: fileWithQty.file.name,
          file_data: base64File,
          file_size: fileWithQty.file.size,
          quality: "0.8",
          force_reanalyze: true
        }
      });

      if (error) {
        throw new Error(error.message || "Edge function error");
      }

      console.log("✅ Edge function response:", result);

      const meshData = result.mesh_data || result.meshData || {};

      setFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? { ...f, meshData, isAnalyzing: false }
            : f
        )
      );

      toast({
        title: "CAD Analysis Complete",
        description: `Mesh generated for ${fileWithQty.file.name}`,
      });
    } catch (error: any) {
      console.error("❌ Error analyzing file:", error);
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, isAnalyzing: false } : f
        )
      );
      toast({
        title: "Analysis Failed",
        description: error.message || "Backend may be waking up - please try again",
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const invalidFiles = selectedFiles.filter(
      (file) =>
        !file.name.toLowerCase().endsWith(".step") &&
        !file.name.toLowerCase().endsWith(".stp")
    );

    if (invalidFiles.length > 0) {
      toast({
        title: "Invalid file type",
        description: "Only .STEP or .STP files are supported",
        variant: "destructive",
      });
      return;
    }

    const filesWithQuantity = selectedFiles.map((file) => ({
      file,
      quantity: 1,
    }));

    const newFiles = [...files, ...filesWithQuantity];
    setFiles(newFiles);

    for (let idx = 0; idx < filesWithQuantity.length; idx++) {
      const fileIndex = files.length + idx;
      await analyzeFile(filesWithQuantity[idx], fileIndex);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (selectedFileIndex >= files.length - 1) {
      setSelectedFileIndex(Math.max(0, files.length - 2));
    }
  };

  const handleContinue = () => setCurrentScreen("configure");
  const handleBack = () => setCurrentScreen("upload");

  const isAnalyzing = files.some((f) => f.isAnalyzing);

  if (currentScreen === "upload") {
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
        onLogMeshData={() => console.log(files)}
      />
    );
  }

  return (
    <PartConfigScreen
      files={files}
      materials={materials}
      processes={processes}
      onBack={handleBack}
      onSubmit={() => console.log("submit")}
      onUpdateFile={() => {}}
      selectedFileIndex={selectedFileIndex}
      onSelectFile={setSelectedFileIndex}
      isSubmitting={uploading}
    />
  );
};
