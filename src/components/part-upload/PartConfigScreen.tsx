import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Info, ChevronDown, Package, DollarSign, Clock } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { CADViewer } from "../CADViewer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { RoutingEditor } from "./RoutingEditor";

interface FileWithData {
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
      {/* Left Sidebar - Configuration Panel (30% width) */}
      <div className="w-[30%] min-w-[380px] border-r bg-muted/30">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-5">
            {/* Header */}
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="mb-3"
              >
                <ChevronLeft className="h-4 w-4 mr-1.5" />
                Back
              </Button>
              <h2 className="text-xl font-bold">Part Configuration</h2>
              <p className="text-xs text-muted-foreground mt-1.5">
                Configure manufacturing parameters for quotation
              </p>
            </div>

            <Separator className="bg-border/60" />

            {/* File Selection */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Parts ({files.length})
              </Label>
              <div className="space-y-1.5">
                {files.map((fileItem, index) => (
                  <button
                    key={index}
                    onClick={() => onSelectFile(index)}
                    className={`w-full p-2.5 rounded-md border text-left transition-all ${
                      selectedFileIndex === index
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-border/50 hover:border-primary/30 hover:bg-muted/50'
                    }`}
                  >
                    <p className="font-medium text-xs truncate">{fileItem.file.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">Qty: {fileItem.quantity}</span>
                      {fileItem.material && (
                        <>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">{fileItem.material}</span>
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Separator className="bg-border/60" />

            {/* Part Configuration */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between w-full group">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Package className="h-3.5 w-3.5" />
                  Basic Information
                </Label>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 mt-3">
                <div>
                  <Label htmlFor="product-name" className="text-xs font-medium">Product Name</Label>
                  <Input
                    id="product-name"
                    value={selectedFile.file.name.replace(/\.[^/.]+$/, "")}
                    readOnly
                    className="mt-1.5 bg-muted/50 text-sm h-9"
                  />
                </div>

                <div>
                  <Label htmlFor="quantity" className="text-xs font-medium">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={selectedFile.quantity}
                    onChange={(e) => onUpdateFile(selectedFileIndex, { quantity: parseInt(e.target.value) || 1 })}
                    className="mt-1.5 text-sm h-9"
                  />
                </div>

                <div>
                  <Label htmlFor="material" className="text-xs font-medium">Material</Label>
                  <Select
                    value={selectedFile.material}
                    onValueChange={(value) => onUpdateFile(selectedFileIndex, { material: value })}
                  >
                    <SelectTrigger className="mt-1.5 h-9 text-sm">
                      <SelectValue placeholder="Select material" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {materials.map((material) => (
                        <SelectItem key={material} value={material} className="text-sm">
                          {material}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator className="bg-border/60" />

            {/* Routing Editor */}
            <RoutingEditor
              routings={selectedFile.analysis?.recommended_routings || (selectedFile.process ? [selectedFile.process] : [])}
              onRoutingsChange={(routings) => {
                onUpdateFile(selectedFileIndex, { 
                  process: routings[0] || '',
                  analysis: {
                    ...selectedFile.analysis,
                    recommended_routings: routings
                  }
                });
              }}
              analysisReasoning={selectedFile.analysis?.routing_reasoning}
            />

            <Separator className="bg-border/60" />

            {/* Analysis Results */}
            {selectedFile.analysis && (
              <>
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex items-center justify-between w-full group">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Part Details
                    </Label>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2.5 mt-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 bg-muted/50 rounded-md border border-border/50">
                        <p className="text-xs text-muted-foreground mb-0.5">Volume</p>
                        <p className="font-semibold text-sm">{selectedFile.analysis.volume_cm3?.toFixed(2)} cm³</p>
                      </div>
                      <div className="p-2.5 bg-muted/50 rounded-md border border-border/50">
                        <p className="text-xs text-muted-foreground mb-0.5">Surface Area</p>
                        <p className="font-semibold text-sm">{selectedFile.analysis.surface_area_cm2?.toFixed(2)} cm²</p>
                      </div>
                    </div>
                    {selectedFile.analysis.detected_features && (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedFile.analysis.detected_features.is_cylindrical && (
                          <Badge variant="outline" className="text-xs">Cylindrical</Badge>
                        )}
                        {selectedFile.analysis.detected_features.has_keyway && (
                          <Badge variant="outline" className="text-xs">Keyway</Badge>
                        )}
                        {selectedFile.analysis.detected_features.has_internal_holes && (
                          <Badge variant="outline" className="text-xs">Internal Holes</Badge>
                        )}
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
                <Separator className="bg-border/60" />
              </>
            )}

            {/* Quote Information */}
            {selectedFile.quote && (
              <>
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex items-center justify-between w-full group">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <DollarSign className="h-3.5 w-3.5" />
                      Quotation Summary
                    </Label>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="p-3 bg-primary/5 border border-primary/20 rounded-md space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Unit Price:</span>
                        <span className="text-lg font-bold text-primary">
                          ${selectedFile.quote.unit_price.toFixed(2)}
                        </span>
                      </div>
                      <Separator className="bg-border/40" />
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Total ({selectedFile.quantity}x):</span>
                        <span className="font-semibold text-sm">
                          ${selectedFile.quote.total_price.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          Lead Time:
                        </span>
                        <span className="text-xs font-medium">
                          {selectedFile.quote.lead_time_days} days
                        </span>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
                <Separator className="bg-border/60" />
              </>
            )}

            {/* Contact Information Toggle */}
            <Collapsible open={showContactForm} onOpenChange={setShowContactForm}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full h-9 text-sm">
                  {showContactForm ? 'Hide' : 'Add'} Contact Information
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 mt-3">
                <div>
                  <Label htmlFor="name" className="text-xs font-medium">Full Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1.5 h-9 text-sm"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="text-xs font-medium">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5 h-9 text-sm"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="company" className="text-xs font-medium">Company</Label>
                  <Input
                    id="company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="mt-1.5 h-9 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="phone" className="text-xs font-medium">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1.5 h-9 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="address" className="text-xs font-medium">Shipping Address</Label>
                  <Textarea
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="mt-1.5 text-sm"
                    rows={2}
                  />
                </div>
                <div>
                  <Label htmlFor="message" className="text-xs font-medium">Additional Notes</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="mt-1.5 text-sm"
                    rows={2}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Submit Button */}
            <Button
              className="w-full h-10"
              onClick={handleSubmit}
              disabled={isSubmitting || !showContactForm || !name || !email}
            >
              {isSubmitting ? 'Submitting Quote Request...' : 'Request Quotation'}
            </Button>

            {!showContactForm && (
              <Alert className="border-primary/20">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Add contact information to request a quote
                </AlertDescription>
              </Alert>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel - 3D Viewer (70% width) */}
      <div className="flex-1 bg-gradient-to-br from-slate-50 to-white">
        <div className="h-full">
          <CADViewer
            file={selectedFile.file}
            fileName={selectedFile.file.name}
            meshId={selectedFile.meshId}
            meshData={selectedFile.meshData}
            detectedFeatures={selectedFile.analysis?.detected_features}
          />
        </div>
      </div>
    </div>
  );
};
