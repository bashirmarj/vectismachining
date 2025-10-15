import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, Info } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { CADViewer } from "../CADViewer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";

interface FileWithData {
  file: File;
  quantity: number;
  material?: string;
  process?: string;
  meshId?: string;
  analysis?: any;
  quote?: any;
}

interface PartConfigScreenProps {
  files: FileWithData[];
  materials: string[];
  processes: string[];
  onBack: () => void;
  onSubmit: (formData: any) => void;
  onUpdateFile: (index: number, updates: Partial<FileWithData>) => void;
  selectedFileIndex: number;
  onSelectFile: (index: number) => void;
  isSubmitting: boolean;
}

export const PartConfigScreen = ({
  files,
  materials,
  processes,
  onBack,
  onSubmit,
  onUpdateFile,
  selectedFileIndex,
  onSelectFile,
  isSubmitting
}: PartConfigScreenProps) => {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [showContactForm, setShowContactForm] = useState(false);

  const selectedFile = files[selectedFileIndex];

  const handleSubmit = () => {
    onSubmit({
      name,
      company,
      email,
      phone,
      address,
      message
    });
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-0">
      {/* Left Sidebar - Configuration Panel */}
      <div className="w-96 border-r bg-background">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6">
            {/* Header */}
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="mb-4"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back to Upload
              </Button>
              <h2 className="text-2xl font-bold">Configure Parts</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Select material, process, and quantity for each part
              </p>
            </div>

            <Separator />

            {/* File Selection */}
            <div className="space-y-3">
              <Label>Parts ({files.length})</Label>
              <div className="space-y-2">
                {files.map((fileItem, index) => (
                  <button
                    key={index}
                    onClick={() => onSelectFile(index)}
                    className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                      selectedFileIndex === index
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <p className="font-medium text-sm truncate">{fileItem.file.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Qty: {fileItem.quantity} {fileItem.material && `• ${fileItem.material}`}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Part Configuration */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <Label>Basic Information</Label>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="product-name">Product Name</Label>
                  <Input
                    id="product-name"
                    value={selectedFile.file.name.replace(/\.[^/.]+$/, "")}
                    readOnly
                    className="mt-1.5 bg-muted"
                  />
                </div>

                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={selectedFile.quantity}
                    onChange={(e) => onUpdateFile(selectedFileIndex, { quantity: parseInt(e.target.value) || 1 })}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="material">Material</Label>
                  <Select
                    value={selectedFile.material}
                    onValueChange={(value) => onUpdateFile(selectedFileIndex, { material: value })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select material" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {materials.map((material) => (
                        <SelectItem key={material} value={material}>
                          {material}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="process">Manufacturing Process</Label>
                  <Select
                    value={selectedFile.process}
                    onValueChange={(value) => onUpdateFile(selectedFileIndex, { process: value })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select process" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {processes.map((process) => (
                        <SelectItem key={process} value={process}>
                          {process}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Analysis Results */}
            {selectedFile.analysis && (
              <>
                <Separator />
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center justify-between w-full">
                    <Label>Part Analysis</Label>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 mt-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Volume</p>
                        <p className="font-semibold">{selectedFile.analysis.volume_cm3?.toFixed(2)} cm³</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Surface Area</p>
                        <p className="font-semibold">{selectedFile.analysis.surface_area_cm2?.toFixed(2)} cm²</p>
                      </div>
                    </div>
                    {selectedFile.analysis.detected_features && (
                      <div className="flex flex-wrap gap-2">
                        {selectedFile.analysis.detected_features.is_cylindrical && (
                          <Badge variant="outline">Cylindrical</Badge>
                        )}
                        {selectedFile.analysis.detected_features.has_keyway && (
                          <Badge variant="outline">Keyway</Badge>
                        )}
                        {selectedFile.analysis.detected_features.has_internal_holes && (
                          <Badge variant="outline">Internal Holes</Badge>
                        )}
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}

            {/* Quote Information */}
            {selectedFile.quote && (
              <>
                <Separator />
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Unit Price:</span>
                    <span className="text-xl font-bold text-primary">
                      ${selectedFile.quote.unit_price.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total ({selectedFile.quantity}x):</span>
                    <span className="font-semibold">
                      ${selectedFile.quote.total_price.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Lead Time:</span>
                    <span className="text-sm font-medium">
                      {selectedFile.quote.lead_time_days} days
                    </span>
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Contact Information Toggle */}
            <Collapsible open={showContactForm} onOpenChange={setShowContactForm}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full">
                  {showContactForm ? 'Hide' : 'Add'} Contact Information
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1.5"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="address">Shipping Address</Label>
                  <Textarea
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="mt-1.5"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="message">Additional Notes</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="mt-1.5"
                    rows={3}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Submit Button */}
            <Button
              size="lg"
              className="w-full"
              onClick={handleSubmit}
              disabled={isSubmitting || !showContactForm || !name || !email}
            >
              {isSubmitting ? 'Submitting...' : 'Request Quote'}
            </Button>

            {!showContactForm && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Add contact information to request a quote
                </AlertDescription>
              </Alert>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel - 3D Viewer */}
      <div className="flex-1 bg-white">
        <div className="h-full p-6">
          <CADViewer
            file={selectedFile.file}
            fileName={selectedFile.file.name}
            meshId={selectedFile.meshId}
            detectedFeatures={selectedFile.analysis?.detected_features}
          />
        </div>
      </div>
    </div>
  );
};
