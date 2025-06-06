import React, { useState } from 'react';
import { Upload, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { BlurredImage } from '@/components/BlurredImage';
import { useUploadFile } from '@/hooks/useUploadFile';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { DIFFICULTY_TERRAIN_OPTIONS, CACHE_SIZE_OPTIONS, CACHE_TYPE_OPTIONS, getDefaultCacheValues } from '@/lib/geocache-constants';

// === GEOCACHE FORM TYPES ===

export interface GeocacheFormData {
  name: string;
  description: string;
  hint: string;
  difficulty: string;
  terrain: string;
  size: string;
  type: string;
  hidden?: boolean;
}

export interface GeocacheFormProps {
  formData: GeocacheFormData;
  onFormDataChange: (data: GeocacheFormData) => void;
  images: string[];
  onImagesChange: (images: string[]) => void;
  isSubmitting?: boolean;
  showRequiredMarkers?: boolean;
  className?: string;
  fieldPrefix?: string;
}

// === FORM FIELD COMPONENTS ===

interface CacheNameFieldProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  fieldId?: string;
}

export function CacheNameField({ value, onChange, required = false, fieldId = "name" }: CacheNameFieldProps) {
  return (
    <div>
      <Label htmlFor={fieldId}>
        Cache Name{required && ' *'}
      </Label>
      <Input
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Give your cache a memorable name"
        required={required}
      />
    </div>
  );
}

interface CacheDescriptionFieldProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  fieldId?: string;
}

export function CacheDescriptionField({ value, onChange, required = false, fieldId = "description" }: CacheDescriptionFieldProps) {
  return (
    <div>
      <Label htmlFor={fieldId}>
        Description{required && ' *'}
      </Label>
      <Textarea
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe your cache, its location, and any special instructions"
        rows={4}
        required={required}
      />
    </div>
  );
}

interface CacheHintFieldProps {
  value: string;
  onChange: (value: string) => void;
  fieldId?: string;
}

export function CacheHintField({ value, onChange, fieldId = "hint" }: CacheHintFieldProps) {
  return (
    <div>
      <Label htmlFor={fieldId}>Hint (Optional)</Label>
      <Input
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Provide a cryptic hint to help seekers"
      />
    </div>
  );
}

// === SELECT FIELD COMPONENTS ===

interface CacheSelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  fieldId: string;
  options: Array<{ value: string; label: string }>;
}

function CacheSelectField({ value, onChange, label, fieldId, options }: CacheSelectFieldProps) {
  return (
    <div>
      <Label htmlFor={fieldId}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={fieldId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function CacheTypeField({ value, onChange, fieldId = "type" }: Omit<CacheSelectFieldProps, 'label' | 'options'>) {
  return (
    <CacheSelectField
      value={value}
      onChange={onChange}
      label="Cache Type"
      fieldId={fieldId}
      options={CACHE_TYPE_OPTIONS}
    />
  );
}

export function CacheSizeField({ value, onChange, fieldId = "size" }: Omit<CacheSelectFieldProps, 'label' | 'options'>) {
  return (
    <CacheSelectField
      value={value}
      onChange={onChange}
      label="Cache Size"
      fieldId={fieldId}
      options={CACHE_SIZE_OPTIONS}
    />
  );
}

export function CacheDifficultyField({ value, onChange, fieldId = "difficulty" }: Omit<CacheSelectFieldProps, 'label' | 'options'>) {
  return (
    <CacheSelectField
      value={value}
      onChange={onChange}
      label="Difficulty"
      fieldId={fieldId}
      options={DIFFICULTY_TERRAIN_OPTIONS}
    />
  );
}

export function CacheTerrainField({ value, onChange, fieldId = "terrain" }: Omit<CacheSelectFieldProps, 'label' | 'options'>) {
  return (
    <CacheSelectField
      value={value}
      onChange={onChange}
      label="Terrain"
      fieldId={fieldId}
      options={DIFFICULTY_TERRAIN_OPTIONS}
    />
  );
}

// === HIDDEN FIELD COMPONENT ===

interface CacheHiddenFieldProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  fieldId?: string;
}

export function CacheHiddenField({ checked, onChange, fieldId = "hidden" }: CacheHiddenFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Checkbox
          id={fieldId}
          checked={checked}
          onCheckedChange={onChange}
        />
        <Label htmlFor={fieldId} className="text-sm font-medium cursor-pointer">
          Hidden from public listings
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">
        When checked, this cache will not appear in public search results and listings. Only people with the direct link can find it.
      </p>
    </div>
  );
}

// === IMAGE MANAGEMENT COMPONENT ===

interface CacheImageManagerProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  disabled?: boolean;
  className?: string;
}

export function CacheImageManager({ images, onImagesChange, disabled = false, className }: CacheImageManagerProps) {
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const { toast } = useToast();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    try {
      const [[_, url]] = await uploadFile(file);
      onImagesChange([...images, url]);
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label>Images</Label>
      
      {/* Image List */}
      {images.map((url, index) => (
        <div key={index} className="flex items-center gap-2 p-2 border rounded">
          <div className="h-16 w-16 rounded overflow-hidden">
            <BlurredImage
              src={url}
              alt={`Cache image ${index + 1}`}
              className="h-full w-full"
              blurIntensity="light"
              defaultBlurred={true}
              showToggle={true}
            />
          </div>
          <span className="flex-1 text-sm truncate">{url}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeImage(index)}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      
      {/* Upload Button */}
      <div className="flex items-center gap-2">
        <Input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          disabled={disabled || isUploading}
          className="hidden"
          id="cache-image-upload"
        />
        <Label
          htmlFor="cache-image-upload"
          className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
        >
          <Upload className="h-4 w-4 mr-2" />
          {isUploading ? "Uploading..." : "Upload Image"}
        </Label>
      </div>
    </div>
  );
}

// === COMPLETE GEOCACHE FORM ===

export function GeocacheForm({
  formData,
  onFormDataChange,
  images,
  onImagesChange,
  isSubmitting = false,
  showRequiredMarkers = false,
  fieldPrefix = "",
  className
}: GeocacheFormProps) {
  
  const updateField = (field: keyof GeocacheFormData, value: string | boolean) => {
    onFormDataChange({
      ...formData,
      [field]: value
    });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Basic Information */}
      <div className="space-y-4">
        <CacheNameField
          value={formData.name}
          onChange={(value) => updateField('name', value)}
          required={showRequiredMarkers}
          fieldId={fieldPrefix ? `${fieldPrefix}-name` : 'name'}
        />
        
        <CacheDescriptionField
          value={formData.description}
          onChange={(value) => updateField('description', value)}
          required={showRequiredMarkers}
          fieldId={fieldPrefix ? `${fieldPrefix}-description` : 'description'}
        />
        
        <CacheHintField
          value={formData.hint}
          onChange={(value) => updateField('hint', value)}
          fieldId={fieldPrefix ? `${fieldPrefix}-hint` : 'hint'}
        />
      </div>

      {/* Cache Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CacheTypeField
          value={formData.type}
          onChange={(value) => updateField('type', value)}
          fieldId={fieldPrefix ? `${fieldPrefix}-type` : 'type'}
        />
        
        <CacheSizeField
          value={formData.size}
          onChange={(value) => updateField('size', value)}
          fieldId={fieldPrefix ? `${fieldPrefix}-size` : 'size'}
        />
        
        <CacheDifficultyField
          value={formData.difficulty}
          onChange={(value) => updateField('difficulty', value)}
          fieldId={fieldPrefix ? `${fieldPrefix}-difficulty` : 'difficulty'}
        />
        
        <CacheTerrainField
          value={formData.terrain}
          onChange={(value) => updateField('terrain', value)}
          fieldId={fieldPrefix ? `${fieldPrefix}-terrain` : 'terrain'}
        />
      </div>

      {/* Visibility Settings */}
      <div className="space-y-4">
        <CacheHiddenField
          checked={formData.hidden || false}
          onChange={(checked) => updateField('hidden', checked)}
          fieldId={fieldPrefix ? `${fieldPrefix}-hidden` : 'hidden'}
        />
      </div>

      {/* Images */}
      <CacheImageManager
        images={images}
        onImagesChange={onImagesChange}
        disabled={isSubmitting}
      />
    </div>
  );
}

// === UTILITY FUNCTIONS ===

export function createDefaultGeocacheFormData(): GeocacheFormData {
  const defaults = getDefaultCacheValues();
  return {
    name: "",
    description: "",
    hint: "",
    difficulty: defaults.difficulty,
    terrain: defaults.terrain,
    size: defaults.size,
    type: defaults.type,
    hidden: false,
  };
}

export function validateGeocacheForm(formData: GeocacheFormData): string[] {
  const errors: string[] = [];
  
  if (!formData.name.trim()) {
    errors.push("Cache name is required");
  }
  
  if (!formData.description.trim()) {
    errors.push("Description is required");
  }
  
  return errors;
}