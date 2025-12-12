import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, X, HelpCircle, Dot, Square, Package, Archive, Footprints, Mountain, Pickaxe, Eye, Search, Brain, Lightbulb, Cpu, Loader2 } from 'lucide-react';
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
      const { key, ...restAttrs } = attrs as any;
      return <Element key={key || index} {...restAttrs} />;
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
      const { key, ...restAttrs } = attrs as any;
      return <Element key={key || index} {...restAttrs} />;
    })}
  </svg>
);
import { CacheIcon } from '@/features/geocache/utils/cacheIcons';
import { useTheme } from "@/shared/hooks/useTheme";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { BlurredImage } from '@/components/BlurredImage';
import { DifficultyTerrainRating } from '@/components/ui/difficulty-terrain-rating';
import { useUploadFile } from '@/shared/hooks/useUploadFile';
import { useToast } from '@/shared/hooks/useToast';
import { cn } from '@/shared/utils/utils';


import type { GeocacheFormData, GeocacheFormProps } from '@/features/geocache/types/geocache-form';

// === FORM FIELD COMPONENTS ===

interface CacheNameFieldProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  fieldId?: string;
}

export function CacheNameField({ value, onChange, required = false, fieldId = "name" }: CacheNameFieldProps) {
  const { t } = useTranslation();
  const suggestions = [
    "Hidden Treasure at [Location]",
    "Secret of [Landmark]",
    "[Location] Mystery Cache",
    "Adventure at [Place]"
  ];

  return (
    <div className="space-y-2 text-foreground">
      <Label htmlFor={fieldId}>
        Cache Name{required && ' *'}
      </Label>
      <Input
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('createCache.form.name.placeholder')}
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
                className="px-2 py-1 bg-muted/50 dark:bg-muted hover:bg-muted rounded text-xs transition-colors"
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
  const { t } = useTranslation();
  return (
    <div className="text-foreground">
      <Label htmlFor={fieldId}>
        Description{required && ' *'}
      </Label>
      <Textarea
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('createCache.form.description.placeholder')}
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
  const { t } = useTranslation();
  return (
    <div className="text-foreground">
      <Label htmlFor={fieldId}>{t('createCache.form.hint.label')}</Label>
      <Input
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('createCache.form.hint.placeholder')}
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

export function CacheTypeField({ value, onChange }: Omit<CacheSelectFieldProps, 'label' | 'options'>) {
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();

  const typeOptions = useMemo(() => [
    {
      value: "traditional",
      name: "Traditional",
      description: t('createCache.form.type.traditional.description'),
      example: t('createCache.form.type.traditional.example')
    },
    {
      value: "multi",
      name: "Multi-Cache",
      description: t('createCache.form.type.multi.description'),
      example: t('createCache.form.type.multi.example')
    },
    {
      value: "mystery",
      name: "Mystery/Puzzle",
      description: t('createCache.form.type.mystery.description'),
      example: t('createCache.form.type.mystery.example')
    }
  ], [t, i18n.language]);

  return (
    <div className="space-y-3 text-foreground">
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
                <CacheIcon type={type.value} size="md" theme={theme} />
              </div>
              <span className="font-medium text-xs text-foreground">{type.name}</span>
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

export function CacheSizeField({ value, onChange }: Omit<CacheSelectFieldProps, 'label' | 'options'>) {
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
    <div className="space-y-3 text-foreground">
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
              <div className="font-medium text-xs text-foreground">{size.name}</div>
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

export function CacheDifficultyField({ value, onChange }: Omit<CacheSelectFieldProps, 'label' | 'options'>) {
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
    <div className="space-y-3 text-foreground">
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
              <span className="font-medium text-xs text-foreground">{level.name}</span>
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

export function CacheTerrainField({ value, onChange }: Omit<CacheSelectFieldProps, 'label' | 'options'>) {
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
    <div className="space-y-3 text-foreground">
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
        <Label htmlFor={fieldId} className="text-sm font-medium cursor-pointer text-foreground">
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
  const { t } = useTranslation();
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const { toast } = useToast();
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: t('createCache.form.image.invalidFileType.title'),
        description: t('createCache.form.image.invalidFileType.description'),
        variant: "destructive",
      });
      return;
    }

    // Show uploading toast
    toast({
      title: "Uploading image...",
      description: `Uploading ${file.name}...`,
    });

    // Add a temporary placeholder
    const tempIndex = images.length;
    setUploadingIndex(tempIndex);
    onImagesChange([...images, '']); // Add empty string as placeholder

    try {
      const [[_, url]] = await uploadFile(file);
      // Replace the placeholder with the actual URL
      const newImages = [...images];
      newImages[tempIndex] = url;
      onImagesChange(newImages);

      toast({
        title: "Success",
        description: "Image uploaded successfully",
      });
    } catch (error) {
      const errorObj = error as { message?: string };
      // Remove the placeholder on error
      onImagesChange(images);

      toast({
        title: t('createCache.form.image.uploadFailed.title'),
        description: errorObj.message || t('createCache.form.image.uploadFailed.description'),
        variant: "destructive",
      });
    } finally {
      setUploadingIndex(null);
      // Reset the file input
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className={cn("space-y-2 text-foreground", className)}>
      <Label>Images</Label>

      {/* Image List */}
      {images.map((url, index) => (
        <div key={index} className="flex items-center gap-2 p-2 border rounded relative">
          <div className="h-16 w-16 rounded overflow-hidden relative">
            {url ? (
              <BlurredImage
                src={url}
                alt={`Cache image ${index + 1}`}
                className="h-full w-full"
                blurIntensity="light"
                defaultBlurred={true}
                showToggle={true}
              />
            ) : (
              <div className="h-full w-full bg-muted flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
              </div>
            )}
            {uploadingIndex === index && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              </div>
            )}
          </div>
          <span className="flex-1 text-sm truncate">
            {url || "Uploading..."}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeImage(index)}
            disabled={disabled || uploadingIndex === index}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {/* Upload Button */}
      <div className="flex items-center gap-2 text-foreground">
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
          className={cn(
            "cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2",
            (disabled || isUploading) && "pointer-events-none opacity-50"
          )}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload Image
            </>
          )}
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
          <h3 className="text-lg font-medium text-foreground">Basic Information</h3>
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
          <h3 className="text-lg font-medium text-foreground">Cache Properties</h3>
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
          <h4 className="text-sm font-medium text-foreground mb-3">How your cache will appear to seekers</h4>
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
          <h3 className="text-lg font-medium text-foreground">Images</h3>
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
          <h3 className="text-lg font-medium text-foreground">Visibility</h3>
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

