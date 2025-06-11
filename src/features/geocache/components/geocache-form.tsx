import React from 'react';
import { Upload, X, Compass, HelpCircle, Dot, Square, Package, Archive, Accessibility, User, Footprints, Mountain, Pickaxe, Eye, Search, Brain, Lightbulb, Cpu, StepBack } from 'lucide-react';
import { sneaker, treesForest } from '@lucide/lab';

// Create React components from Lucide Lab icons
const SneakerIcon = ({ className, ...props }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {sneaker.map(([element, attrs], index) => {
      const Element = element as keyof JSX.IntrinsicElements;
      return <Element key={index} {...attrs} />;
    })}
  </svg>
);

const TreesForestIcon = ({ className, ...props }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {treesForest.map(([element, attrs], index) => {
      const Element = element as keyof JSX.IntrinsicElements;
      return <Element key={index} {...attrs} />;
    })}
  </svg>
);
import { getCacheIcon } from '@/lib/cacheIcons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { BlurredImage } from '@/components/BlurredImage';
import { DifficultyTerrainRating } from '@/components/ui/difficulty-terrain-rating';
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
  const suggestions = [
    "Hidden Treasure at [Location]",
    "Secret of [Landmark]", 
    "[Location] Mystery Cache",
    "Adventure at [Place]"
  ];

  return (
    <div className="space-y-2">
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
      {!value && (
        <div className="text-xs text-muted-foreground">
          <p className="mb-1">Name ideas:</p>
          <div className="flex flex-wrap gap-1">
            {suggestions.map((suggestion, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onChange(suggestion)}
                className="px-2 py-1 bg-muted/50 hover:bg-muted rounded text-xs transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
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
  const typeOptions = [
    { 
      value: "traditional", 
      name: "Traditional", 
      description: "Classic geocache at given coordinates",
      example: "Container hidden at the exact GPS location"
    },
    { 
      value: "multi", 
      name: "Multi-Cache", 
      description: "Multiple stages leading to final cache",
      example: "Visit several waypoints to gather final coordinates"
    },
    { 
      value: "mystery", 
      name: "Mystery/Puzzle", 
      description: "Solve a puzzle to find coordinates",
      example: "Decode clues, solve riddles, or complete challenges"
    }
  ];
  
  return (
    <div className="space-y-3">
      <Label>
        What type of cache?
        <span className="text-xs text-muted-foreground block mt-1">Choose the cache style</span>
      </Label>
      
      <div className="grid grid-cols-3 gap-2">
        {typeOptions.map((type) => {
          return (
            <button
              key={type.value}
              type="button"
              onClick={() => onChange(type.value)}
              className={`p-2 rounded-lg border text-center transition-all ${
                value === type.value
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-950'
                  : 'border-gray-200 hover:border-gray-300 bg-white dark:bg-gray-900'
              }`}
            >
              <div className="h-5 w-5 mx-auto mb-1">
                {getCacheIcon(type.value, 'md')}
              </div>
              <span className="font-medium text-xs">{type.name}</span>
            </button>
          );
        })}
      </div>
      
      {value && (
        <div className="bg-muted/30 p-2 rounded-md">
          <p className="text-xs text-orange-700 dark:text-orange-300">
            {typeOptions.find(t => t.value === value)?.description}
          </p>
        </div>
      )}
    </div>
  );
}

export function CacheSizeField({ value, onChange, fieldId = "size" }: Omit<CacheSelectFieldProps, 'label' | 'options'>) {
  const sizeOptions = [
    { 
      value: "micro", 
      name: "Micro", 
      icon: Dot,
      description: "Film canister or smaller",
      example: "Pill bottle, magnetic nano"
    },
    { 
      value: "small", 
      name: "Small", 
      icon: Square,
      description: "Sandwich container size",
      example: "Small tupperware, mint tin"
    },
    { 
      value: "regular", 
      name: "Regular", 
      icon: Package,
      description: "Shoebox or tupperware",
      example: "Lock & lock container, shoebox"
    },
    { 
      value: "large", 
      name: "Large", 
      icon: Archive,
      description: "Bucket or ammo can",
      example: "Ammo can, large storage box"
    },
    { 
      value: "other", 
      name: "Other", 
      icon: HelpCircle,
      description: "Unusual or virtual cache",
      example: "Virtual cache, unusual container"
    }
  ];
  
  return (
    <div className="space-y-3">
      <Label>
        Container size
        <span className="text-xs text-muted-foreground block mt-1">Choose the container size</span>
      </Label>
      
      <div className="grid grid-cols-5 gap-2">
        {sizeOptions.map((size) => {
          const IconComponent = size.icon;
          return (
            <button
              key={size.value}
              type="button"
              onClick={() => onChange(size.value)}
              className={`p-2 rounded-lg border text-center transition-all ${
                value === size.value
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-950'
                  : 'border-gray-200 hover:border-gray-300 bg-white dark:bg-gray-900'
              }`}
            >
              <IconComponent className={`mx-auto mb-1 text-purple-600 ${
                size.value === 'micro' ? 'h-3 w-3' :
                size.value === 'small' ? 'h-4 w-4' :
                size.value === 'regular' ? 'h-5 w-5' :
                size.value === 'large' ? 'h-6 w-6' :
                'h-5 w-5'
              }`} />
              <div className="font-medium text-xs">{size.name}</div>
            </button>
          );
        })}
      </div>
      
      {value && (
        <div className="bg-muted/30 p-2 rounded-md">
          <p className="text-xs text-purple-700 dark:text-purple-300">
            {sizeOptions.find(s => s.value === value)?.description}
          </p>
        </div>
      )}
    </div>
  );
}

export function CacheDifficultyField({ value, onChange, fieldId = "difficulty" }: Omit<CacheSelectFieldProps, 'label' | 'options'>) {
  const numericValue = parseInt(value) || 1;
  
  const difficultyLevels = [
    { 
      level: 1, 
      name: "Easy", 
      icon: Eye,
      description: "Simple find, minimal thinking required",
      example: "Cache is visible or in an obvious hiding spot"
    },
    { 
      level: 2, 
      name: "Moderate", 
      icon: Search,
      description: "Some problem-solving needed",
      example: "May require reading clues or simple puzzle solving"
    },
    { 
      level: 3, 
      name: "Challenging", 
      icon: Lightbulb,
      description: "Requires planning and effort",
      example: "Multi-step puzzle or research required"
    },
    { 
      level: 4, 
      name: "Hard", 
      icon: Brain,
      description: "Challenging, may need special skills",
      example: "Complex puzzles, special tools, or knowledge needed"
    },
    { 
      level: 5, 
      name: "Expert", 
      icon: Cpu,
      description: "Extremely difficult, expert level",
      example: "Advanced cryptography, specialized skills required"
    }
  ];
  
  return (
    <div className="space-y-3">
      <Label>
        How hard is it to solve?
        <span className="text-xs text-muted-foreground block mt-1">Mental challenge level</span>
      </Label>
      
      {/* Desktop: 5 options in a single row */}
      <div className="hidden md:grid md:grid-cols-5 gap-2">
        {difficultyLevels.map((level) => {
          const IconComponent = level.icon;
          return (
            <button
              key={level.level}
              type="button"
              onClick={() => onChange(level.level.toString())}
              className={`p-2 rounded-lg border text-center transition-all ${
                numericValue === level.level
                  ? 'border-green-500 bg-green-50 dark:bg-green-950'
                  : 'border-gray-200 hover:border-gray-300 bg-white dark:bg-gray-900'
              }`}
            >
              <IconComponent className="h-4 w-4 mx-auto mb-1 text-green-600" />
              <div className="flex gap-1 justify-center mb-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-1.5 rounded ${
                      i <= level.level ? "bg-green-600" : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>
              <span className="font-medium text-xs">{level.name}</span>
            </button>
          );
        })}
      </div>
      
      {/* Mobile: 3 options in first row, 2 options centered in second row */}
      <div className="md:hidden space-y-2">
        {/* First row: 3 options */}
        <div className="grid grid-cols-3 gap-2">
          {difficultyLevels.slice(0, 3).map((level) => {
            const IconComponent = level.icon;
            return (
              <button
                key={level.level}
                type="button"
                onClick={() => onChange(level.level.toString())}
                className={`p-2 rounded-lg border text-center transition-all ${
                  numericValue === level.level
                    ? 'border-green-500 bg-green-50 dark:bg-green-950'
                    : 'border-gray-200 hover:border-gray-300 bg-white dark:bg-gray-900'
                }`}
              >
                <IconComponent className="h-4 w-4 mx-auto mb-1 text-green-600" />
                <div className="flex gap-1 justify-center mb-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 w-1.5 rounded ${
                        i <= level.level ? "bg-green-600" : "bg-gray-200"
                      }`}
                    />
                  ))}
                </div>
                <span className="font-medium text-xs">{level.name}</span>
              </button>
            );
          })}
        </div>
        
        {/* Second row: 2 options centered */}
        <div className="flex gap-2 justify-center">
          {difficultyLevels.slice(3).map((level) => {
            const IconComponent = level.icon;
            return (
              <button
                key={level.level}
                type="button"
                onClick={() => onChange(level.level.toString())}
                className={`p-2 rounded-lg border text-center transition-all w-24 ${
                  numericValue === level.level
                    ? 'border-green-500 bg-green-50 dark:bg-green-950'
                    : 'border-gray-200 hover:border-gray-300 bg-white dark:bg-gray-900'
                }`}
              >
                <IconComponent className="h-4 w-4 mx-auto mb-1 text-green-600" />
                <div className="flex gap-1 justify-center mb-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 w-1.5 rounded ${
                        i <= level.level ? "bg-green-600" : "bg-gray-200"
                      }`}
                    />
                  ))}
                </div>
                <span className="font-medium text-xs">{level.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      
      {numericValue > 0 && (
        <div className="bg-muted/30 p-2 rounded-md">
          <p className="text-xs text-green-700 dark:text-green-300">
            {difficultyLevels.find(l => l.level === numericValue)?.description}
          </p>
        </div>
      )}
    </div>
  );
}

export function CacheTerrainField({ value, onChange, fieldId = "terrain" }: Omit<CacheSelectFieldProps, 'label' | 'options'>) {
  const numericValue = parseInt(value) || 1;
  
  const terrainLevels = [
    { 
      level: 1, 
      name: "Easy Walk", 
      icon: SneakerIcon,
      description: "Wheelchair accessible, paved paths",
      example: "Sidewalks, parking lots, accessible trails"
    },
    { 
      level: 2, 
      name: "Light Hike", 
      icon: Footprints,
      description: "Suitable for most, minor obstacles",
      example: "Gravel paths, slight inclines, easy trails"
    },
    { 
      level: 3, 
      name: "Moderate Hike", 
      icon: TreesForestIcon,
      description: "Not suitable for all, some climbing",
      example: "Uneven terrain, hills, some scrambling"
    },
    { 
      level: 4, 
      name: "Difficult Hike", 
      icon: Mountain,
      description: "Experienced hikers, special equipment",
      example: "Steep climbs, rough terrain, may need gear"
    },
    { 
      level: 5, 
      name: "Extreme", 
      icon: Pickaxe,
      description: "Extreme conditions, serious hazards",
      example: "Rock climbing, dangerous conditions, expert only"
    }
  ];
  
  return (
    <div className="space-y-3">
      <Label>
        How hard is it to reach?
        <span className="text-xs text-muted-foreground block mt-1">Physical challenge level</span>
      </Label>
      
      {/* Desktop: 5 options in a single row */}
      <div className="hidden md:grid md:grid-cols-5 gap-2">
        {terrainLevels.map((level) => {
          const IconComponent = level.icon;
          return (
            <button
              key={level.level}
              type="button"
              onClick={() => onChange(level.level.toString())}
              className={`p-2 rounded-lg border text-center transition-all ${
                numericValue === level.level
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-200 hover:border-gray-300 bg-white dark:bg-gray-900'
              }`}
            >
              <IconComponent className="h-4 w-4 mx-auto mb-1 text-blue-600" />
              <div className="flex gap-1 justify-center mb-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-1.5 rounded ${
                      i <= level.level ? "bg-blue-600" : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>
              <span className="font-medium text-xs">{level.name}</span>
            </button>
          );
        })}
      </div>
      
      {/* Mobile: 3 options in first row, 2 options centered in second row */}
      <div className="md:hidden space-y-2">
        {/* First row: 3 options */}
        <div className="grid grid-cols-3 gap-2">
          {terrainLevels.slice(0, 3).map((level) => {
            const IconComponent = level.icon;
            return (
              <button
                key={level.level}
                type="button"
                onClick={() => onChange(level.level.toString())}
                className={`p-2 rounded-lg border text-center transition-all ${
                  numericValue === level.level
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-200 hover:border-gray-300 bg-white dark:bg-gray-900'
                }`}
              >
                <IconComponent className="h-4 w-4 mx-auto mb-1 text-blue-600" />
                <div className="flex gap-1 justify-center mb-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 w-1.5 rounded ${
                        i <= level.level ? "bg-blue-600" : "bg-gray-200"
                      }`}
                    />
                  ))}
                </div>
                <span className="font-medium text-xs">{level.name}</span>
              </button>
            );
          })}
        </div>
        
        {/* Second row: 2 options centered */}
        <div className="flex gap-2 justify-center">
          {terrainLevels.slice(3).map((level) => {
            const IconComponent = level.icon;
            return (
              <button
                key={level.level}
                type="button"
                onClick={() => onChange(level.level.toString())}
                className={`p-2 rounded-lg border text-center transition-all w-24 ${
                  numericValue === level.level
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-200 hover:border-gray-300 bg-white dark:bg-gray-900'
                }`}
              >
                <IconComponent className="h-4 w-4 mx-auto mb-1 text-blue-600" />
                <div className="flex gap-1 justify-center mb-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 w-1.5 rounded ${
                        i <= level.level ? "bg-blue-600" : "bg-gray-200"
                      }`}
                    />
                  ))}
                </div>
                <span className="font-medium text-xs">{level.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      
      {numericValue > 0 && (
        <div className="bg-muted/30 p-2 rounded-md">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            {terrainLevels.find(l => l.level === numericValue)?.description}
          </p>
        </div>
      )}
    </div>
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
    <div className={cn("space-y-6", className)}>
      {/* Basic Information */}
      <div className="space-y-4">
        <div className="border-b pb-2">
          <h3 className="text-lg font-medium">Basic Information</h3>
          <p className="text-sm text-muted-foreground">Tell seekers about your cache</p>
        </div>
        
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

      {/* Cache Properties */}
      <div className="space-y-4">
        <div className="border-b pb-2">
          <h3 className="text-lg font-medium">Cache Properties</h3>
          <p className="text-sm text-muted-foreground">Set the type, size, and challenge level</p>
        </div>
        
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
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        {/* Rating Preview */}
        <div className="bg-muted/20 border border-muted rounded-lg p-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">How your cache will appear to seekers</h4>
          <DifficultyTerrainRating
            difficulty={parseInt(formData.difficulty) || 1}
            terrain={parseInt(formData.terrain) || 1}
            cacheSize={formData.size}
            showLabels={true}
            size="default"
          />
        </div>
      </div>

      {/* Images */}
      <div className="space-y-4">
        <div className="border-b pb-2">
          <h3 className="text-lg font-medium">Images</h3>
          <p className="text-sm text-muted-foreground">Add photos to help seekers identify the area</p>
        </div>
        
        <CacheImageManager
          images={images}
          onImagesChange={onImagesChange}
          disabled={isSubmitting}
        />
      </div>

      {/* Visibility Settings */}
      <div className="space-y-4">
        <div className="border-b pb-2">
          <h3 className="text-lg font-medium">Visibility</h3>
          <p className="text-sm text-muted-foreground">Control who can find your cache</p>
        </div>
        
        <CacheHiddenField
          checked={formData.hidden || false}
          onChange={(checked) => updateField('hidden', checked)}
          fieldId={fieldPrefix ? `${fieldPrefix}-hidden` : 'hidden'}
        />
      </div>
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