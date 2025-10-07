import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, File, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const PartUploadForm = () => {
  const [email, setEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Check if it's a STEP file
      const fileName = selectedFile.name.toLowerCase();
      if (fileName.endsWith('.step') || fileName.endsWith('.stp')) {
        setFile(selectedFile);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload a STEP file (.step or .stp)",
          variant: "destructive",
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file || !email) {
      toast({
        title: "Missing information",
        description: "Please provide both email and file",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to upload files",
          variant: "destructive",
        });
        setUploading(false);
        return;
      }

      // Upload file to Supabase Storage
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('part-files')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Call edge function to send email
      const { error: functionError } = await supabase.functions.invoke(
        'send-quotation-request',
        {
          body: {
            fileName: file.name,
            filePath: filePath,
            userEmail: email,
          },
        }
      );

      if (functionError) {
        throw functionError;
      }

      toast({
        title: "Success!",
        description: "Your quotation request has been submitted. We'll contact you soon.",
      });

      // Reset form
      setEmail("");
      setFile(null);
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to submit quotation request",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardContent className="p-6">
        <div className="mb-6">
          <h3 className="text-2xl font-bold mb-2">Request a Quotation</h3>
          <p className="text-muted-foreground">
            Upload your STEP file and we'll provide you with a detailed quote for manufacturing your custom parts.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Your Email Address</Label>
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
            <Label htmlFor="file-upload">STEP File (.step or .stp)</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors">
              <input
                id="file-upload"
                type="file"
                accept=".step,.stp"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                {file ? (
                  <div className="flex items-center gap-3 text-primary">
                    <File className="h-8 w-8" />
                    <div className="text-left">
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                ) : (
                  <>
                    <Upload className="h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium mb-1">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">
                      STEP files only (.step or .stp)
                    </p>
                  </>
                )}
              </label>
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={uploading}>
            {uploading ? (
              <>Submitting Request...</>
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
