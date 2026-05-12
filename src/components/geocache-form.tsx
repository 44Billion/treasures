import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, HelpCircle, Dot, Square, Package, Archive, Footprints, Mountain, Pickaxe, Eye, Search, Brain, Lightbulb, Cpu, Loader2, ImagePlus, Camera } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
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
      const Element = element as React.ElementType;
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
      const Element = element as React.ElementType;
      const { key, ...restAttrs } = attrs as any;
      return <Element key={key || index} {...restAttrs} />;
    })}
  </svg>
);
import { CacheIcon } from '@/utils/cacheIcons';
import { useTheme } from "@/hooks/useTheme";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

import { DifficultyTerrainRating } from '@/components/ui/difficulty-terrain-rating';
import { useUploadFile } from '@/hooks/useUploadFile';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/utils/utils';


import type { GeocacheFormData, GeocacheFormProps } from '@/types/geocache-form';

// === FORM FIELD COMPONENTS ===

/** Small, accessible "required" indicator used across form fields. */
function RequiredMark() {
  return (
    <>
      <span aria-hidden="true" className="ml-1 text-destructive">*</span>
      <span className="sr-only">(required)</span>
    </>
  );
}

/** Inline error message bound via aria-describedby to the field. */
function FieldError({ id, message }: { id: string; message?: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive mt-1">
      {message}
    </p>
  );
}

interface CacheNameFieldProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  fieldId?: string;
  error?: string | null;
}

export function CacheNameField({ value, onChange, required = false, fieldId = "name", error }: CacheNameFieldProps) {
  const { t } = useTranslation();
  const errorId = `${fieldId}-error`;
  const suggestions = [
    "Hidden Treasure at [Location]",
    "Secret of [Landmark]",
    "[Location] Mystery Cache",
    "Adventure at [Place]"
  ];

  return (
    <div className="space-y-2 text-foreground">
      <Label htmlFor={fieldId}>
        Cache Name{required && <RequiredMark />}
      </Label>
      <Input
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('createCache.form.name.placeholder')}
        required={required}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(error && 'border-destructive focus-visible:ring-destructive')}
      />
      <FieldError id={errorId} message={error} />
      {!value && !error && (
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
  error?: string | null;
}

export function CacheDescriptionField({ value, onChange, required = false, fieldId = "description", error }: CacheDescriptionFieldProps) {
  const { t } = useTranslation();
  const errorId = `${fieldId}-error`;
  return (
    <div className="text-foreground">
      <Label htmlFor={fieldId}>
        Description{required && <RequiredMark />}
      </Label>
      <Textarea
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('createCache.form.description.placeholder')}
        rows={4}
        required={required}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(error && 'border-destructive focus-visible:ring-destructive')}
      />
      <FieldError id={errorId} message={error} />
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

interface CacheKeyFieldProps {
  value: string;
  onChange: (value: string) => void;
  fieldId?: string;
}

export function CacheKeyField({ value, onChange, fieldId = "key" }: CacheKeyFieldProps) {
  const { t } = useTranslation();
  return (
    <div className="text-foreground">
      <Label htmlFor={fieldId}>{t('createCache.form.key.label')}</Label>
      <Input
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('createCache.form.key.placeholder')}
      />
      <p className="text-xs text-muted-foreground mt-1">
        {t('createCache.form.key.help')}
      </p>
    </div>
  );
}

interface ContentWarningFieldProps {
  value: string;
  onChange: (value: string) => void;
  fieldId?: string;
}

export function ContentWarningField({ value, onChange, fieldId = "contentWarning" }: ContentWarningFieldProps) {
  return (
    <div className="text-foreground">
      <Label htmlFor={fieldId}>
        Content Warning (Spoiler)
        <span className="ml-2 text-xs text-muted-foreground font-normal">
          Optional - Blur images until revealed
        </span>
      </Label>
      <Input
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g., 'Spoiler', 'Contains solution', or leave blank for no warning"
      />
      <p className="text-xs text-muted-foreground mt-1">
        If set, images will be blurred by default. Useful for puzzle caches or when images reveal the hiding spot.
      </p>
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
  const { t } = useTranslation();

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
  ], [t]);

  const typeGroupId = 'cache-type-group';

  const handleRadioKey = (e: React.KeyboardEvent<HTMLButtonElement>, currentIdx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const delta = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
    const next = (currentIdx + delta + typeOptions.length) % typeOptions.length;
    onChange(typeOptions[next].value);
    const nextEl = document.querySelector<HTMLButtonElement>(`#${typeGroupId} [data-radio-idx="${next}"]`);
    nextEl?.focus();
  };

  return (
    <div className="space-y-3 text-foreground">
      <Label id={`${typeGroupId}-label`}>
        What type of cache?
        <span className="text-xs text-muted-foreground block mt-1">Choose the cache style</span>
      </Label>

      <div
        id={typeGroupId}
        role="radiogroup"
        aria-labelledby={`${typeGroupId}-label`}
        className="grid grid-cols-3 gap-2"
      >
        {typeOptions.map((type, idx) => {
          const selected = value === type.value;
          return (
            <button
              key={type.value}
              type="button"
              role="radio"
              aria-checked={selected}
              data-radio-idx={idx}
              tabIndex={selected || (!value && idx === 0) ? 0 : -1}
              onClick={() => onChange(type.value)}
              onKeyDown={(e) => handleRadioKey(e, idx)}
              className={`p-2 rounded-lg border text-center transition-all ${
                selected
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-border hover:border-muted-foreground/40 bg-card'
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
          <p className="text-xs text-orange-700 dark:text-orange-300 adventure:text-amber-800 mojave:text-primary">
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

  const sizeGroupId = 'cache-size-group';
  const handleSizeKey = (e: React.KeyboardEvent<HTMLButtonElement>, currentIdx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const delta = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
    const next = (currentIdx + delta + sizeOptions.length) % sizeOptions.length;
    onChange(sizeOptions[next].value);
    const nextEl = document.querySelector<HTMLButtonElement>(`#${sizeGroupId} [data-radio-idx="${next}"]`);
    nextEl?.focus();
  };

  return (
    <div className="space-y-3 text-foreground">
      <Label id={`${sizeGroupId}-label`}>
        Container size
        <span className="text-xs text-muted-foreground block mt-1">Choose the container size</span>
      </Label>

      <div
        id={sizeGroupId}
        role="radiogroup"
        aria-labelledby={`${sizeGroupId}-label`}
        className="grid grid-cols-5 gap-2"
      >
        {sizeOptions.map((size, idx) => {
          const IconComponent = size.icon;
          const selected = value === size.value;
          return (
            <button
              key={size.value}
              type="button"
              role="radio"
              aria-checked={selected}
              data-radio-idx={idx}
              tabIndex={selected || (!value && idx === 0) ? 0 : -1}
              onClick={() => onChange(size.value)}
              onKeyDown={(e) => handleSizeKey(e, idx)}
              className={`p-2 rounded-lg border text-center transition-all ${
                selected
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-border hover:border-muted-foreground/40 bg-card'
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
          <p className="text-xs text-purple-700 dark:text-purple-300 adventure:text-amber-800 mojave:text-primary">
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

  const difficultyGroupId = 'cache-difficulty-group';
  const handleDifficultyKey = (e: React.KeyboardEvent<HTMLButtonElement>, currentIdx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const delta = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
    const next = (currentIdx + delta + difficultyLevels.length) % difficultyLevels.length;
    onChange(difficultyLevels[next].level.toString());
    // Focus the matching visible button (desktop or mobile)
    const candidates = document.querySelectorAll<HTMLButtonElement>(
      `[data-group="${difficultyGroupId}"][data-radio-idx="${next}"]`
    );
    for (const el of Array.from(candidates)) {
      if (el.offsetParent !== null) { el.focus(); break; }
    }
  };

  return (
    <div
      className="space-y-3 text-foreground"
      role="radiogroup"
      aria-labelledby={`${difficultyGroupId}-label`}
    >
      <Label id={`${difficultyGroupId}-label`}>
        How hard is it to solve?
        <span className="text-xs text-muted-foreground block mt-1">Mental challenge level</span>
      </Label>

      {/* Desktop: 5 options in a single row */}
      <div className="hidden lg:grid lg:grid-cols-5 gap-2">
        {difficultyLevels.map((level, idx) => {
          const IconComponent = level.icon;
          const selected = numericValue === level.level;
          return (
            <button
              key={level.level}
              type="button"
              role="radio"
              aria-checked={selected}
              data-group={difficultyGroupId}
              data-radio-idx={idx}
              tabIndex={selected || (numericValue === 0 && idx === 0) ? 0 : -1}
              onClick={() => onChange(level.level.toString())}
              onKeyDown={(e) => handleDifficultyKey(e, idx)}
              className={`p-2 rounded-lg border text-center transition-all ${
                selected
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-muted-foreground/40 bg-card'
              }`}
            >
              <IconComponent className="h-4 w-4 mx-auto mb-1 text-primary" />
              <div className="flex gap-1 justify-center mb-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-1.5 rounded ${
                      i <= level.level ? "bg-primary" : "bg-muted"
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
      <div className="lg:hidden space-y-2">
        {/* First row: 3 options */}
        <div className="grid grid-cols-3 gap-2">
          {difficultyLevels.slice(0, 3).map((level, idx) => {
            const IconComponent = level.icon;
            const selected = numericValue === level.level;
            return (
              <button
                key={level.level}
                type="button"
                role="radio"
                aria-checked={selected}
                data-group={difficultyGroupId}
                data-radio-idx={idx}
                tabIndex={selected || (numericValue === 0 && idx === 0) ? 0 : -1}
                onClick={() => onChange(level.level.toString())}
                onKeyDown={(e) => handleDifficultyKey(e, idx)}
                className={`p-2 rounded-lg border text-center transition-all ${
                  selected
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground/40 bg-card'
                }`}
              >
                <IconComponent className="h-4 w-4 mx-auto mb-1 text-primary" />
                <div className="flex gap-1 justify-center mb-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 w-1.5 rounded ${
                        i <= level.level ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <span className="font-medium text-xs text-foreground">{level.name}</span>
              </button>
            );
          })}
        </div>

        {/* Second row: 2 options centered, matching top row cell width */}
        <div className="flex gap-2 justify-center">
          {difficultyLevels.slice(3).map((level, offset) => {
            const IconComponent = level.icon;
            const idx = offset + 3;
            const selected = numericValue === level.level;
            return (
              <button
                key={level.level}
                type="button"
                role="radio"
                aria-checked={selected}
                data-group={difficultyGroupId}
                data-radio-idx={idx}
                tabIndex={selected ? 0 : -1}
                onClick={() => onChange(level.level.toString())}
                onKeyDown={(e) => handleDifficultyKey(e, idx)}
                className={`p-2 rounded-lg border text-center transition-all w-[calc((100%-1rem)/3)] ${
                  selected
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground/40 bg-card'
                }`}
              >
                <IconComponent className="h-4 w-4 mx-auto mb-1 text-primary" />
                <div className="flex gap-1 justify-center mb-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 w-1.5 rounded ${
                        i <= level.level ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <span className="font-medium text-xs text-foreground">{level.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {numericValue > 0 && (
        <div className="bg-muted/30 p-2 rounded-md">
          <p className="text-xs text-primary dark:text-primary">
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

  const terrainGroupId = 'cache-terrain-group';
  const handleTerrainKey = (e: React.KeyboardEvent<HTMLButtonElement>, currentIdx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const delta = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
    const next = (currentIdx + delta + terrainLevels.length) % terrainLevels.length;
    onChange(terrainLevels[next].level.toString());
    const candidates = document.querySelectorAll<HTMLButtonElement>(
      `[data-group="${terrainGroupId}"][data-radio-idx="${next}"]`
    );
    for (const el of Array.from(candidates)) {
      if (el.offsetParent !== null) { el.focus(); break; }
    }
  };

  return (
    <div
      className="space-y-3 text-foreground"
      role="radiogroup"
      aria-labelledby={`${terrainGroupId}-label`}
    >
      <Label id={`${terrainGroupId}-label`}>
        How hard is it to reach?
        <span className="text-xs text-muted-foreground block mt-1">Physical challenge level</span>
      </Label>

      {/* Desktop: 5 options in a single row */}
      <div className="hidden lg:grid lg:grid-cols-5 gap-2">
        {terrainLevels.map((level, idx) => {
          const IconComponent = level.icon;
          const selected = numericValue === level.level;
          return (
            <button
              key={level.level}
              type="button"
              role="radio"
              aria-checked={selected}
              data-group={terrainGroupId}
              data-radio-idx={idx}
              tabIndex={selected || (numericValue === 0 && idx === 0) ? 0 : -1}
              onClick={() => onChange(level.level.toString())}
              onKeyDown={(e) => handleTerrainKey(e, idx)}
              className={`p-2 rounded-lg border text-center transition-all ${
                selected
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-border hover:border-muted-foreground/40 bg-card'
              }`}
            >
              <IconComponent className="h-4 w-4 mx-auto mb-1 text-blue-600" />
              <div className="flex gap-1 justify-center mb-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-1.5 rounded ${
                      i <= level.level ? "bg-blue-600" : "bg-muted"
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
      <div className="lg:hidden space-y-2">
        {/* First row: 3 options */}
        <div className="grid grid-cols-3 gap-2">
          {terrainLevels.slice(0, 3).map((level, idx) => {
            const IconComponent = level.icon;
            const selected = numericValue === level.level;
            return (
              <button
                key={level.level}
                type="button"
                role="radio"
                aria-checked={selected}
                data-group={terrainGroupId}
                data-radio-idx={idx}
                tabIndex={selected || (numericValue === 0 && idx === 0) ? 0 : -1}
                onClick={() => onChange(level.level.toString())}
                onKeyDown={(e) => handleTerrainKey(e, idx)}
                className={`p-2 rounded-lg border text-center transition-all ${
                  selected
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-border hover:border-muted-foreground/40 bg-card'
                }`}
              >
                <IconComponent className="h-4 w-4 mx-auto mb-1 text-blue-600" />
                <div className="flex gap-1 justify-center mb-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 w-1.5 rounded ${
                        i <= level.level ? "bg-blue-600" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <span className="font-medium text-xs text-foreground">{level.name}</span>
              </button>
            );
          })}
        </div>

        {/* Second row: 2 options centered, matching top row cell width */}
        <div className="flex gap-2 justify-center">
          {terrainLevels.slice(3).map((level, offset) => {
            const IconComponent = level.icon;
            const idx = offset + 3;
            const selected = numericValue === level.level;
            return (
              <button
                key={level.level}
                type="button"
                role="radio"
                aria-checked={selected}
                data-group={terrainGroupId}
                data-radio-idx={idx}
                tabIndex={selected ? 0 : -1}
                onClick={() => onChange(level.level.toString())}
                onKeyDown={(e) => handleTerrainKey(e, idx)}
                className={`p-2 rounded-lg border text-center transition-all w-[calc((100%-1rem)/3)] ${
                  selected
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-border hover:border-muted-foreground/40 bg-card'
                }`}
              >
                <IconComponent className="h-4 w-4 mx-auto mb-1 text-blue-600" />
                <div className="flex gap-1 justify-center mb-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 w-1.5 rounded ${
                        i <= level.level ? "bg-blue-600" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <span className="font-medium text-xs text-foreground">{level.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {numericValue > 0 && (
        <div className="bg-muted/30 p-2 rounded-md">
          <p className="text-xs text-blue-700 dark:text-blue-300 adventure:text-amber-800 mojave:text-primary">
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

// === CACHE STATUS FIELD (lifecycle: active / maintenance / archived) ===

interface CacheStatusFieldProps {
  value: 'archived' | 'maintenance' | undefined;
  onChange: (value: 'archived' | 'maintenance' | undefined) => void;
  fieldId?: string;
}

export function CacheStatusField({ value, onChange, fieldId = "status" }: CacheStatusFieldProps) {
  const options: Array<{
    id: 'active' | 'maintenance' | 'archived';
    label: string;
    description: string;
  }> = [
    {
      id: 'active',
      label: 'Active',
      description: 'Healthy and findable. Shown on the map by default.',
    },
    {
      id: 'maintenance',
      label: 'Needs maintenance',
      description: 'Temporarily disabled. Hidden from the map unless seekers opt in.',
    },
    {
      id: 'archived',
      label: 'Archived',
      description: 'Officially retired. Hidden from the map unless seekers opt in.',
    },
  ];

  const currentId: 'active' | 'maintenance' | 'archived' = value ?? 'active';

  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId} className="text-sm font-medium text-foreground">
        Listing status
      </Label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Listing status">
        {options.map((opt) => {
          const active = currentId === opt.id;
          return (
            <button
              key={opt.id}
              id={opt.id === currentId ? fieldId : undefined}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.id === 'active' ? undefined : opt.id)}
              className={cn(
                "text-left rounded-md border p-3 transition-colors",
                active
                  ? opt.id === 'archived'
                    ? "border-muted-foreground/50 bg-muted ring-1 ring-muted-foreground/30"
                    : opt.id === 'maintenance'
                      ? "border-amber-500/60 bg-amber-500/5 ring-1 ring-amber-500/40"
                      : "border-primary bg-primary/5 ring-1 ring-primary/40"
                  : "border-border bg-background hover:bg-muted/40"
              )}
            >
              <div className="text-sm font-medium text-foreground">{opt.label}</div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{opt.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// === IMAGE MANAGEMENT COMPONENT ===

interface CacheImageManagerProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  disabled?: boolean;
  className?: string;
  /**
   * Called whenever the component starts or stops uploading an image.
   * Parents can use this to gate a Publish/Save button so users don't
   * submit while image uploads are still in flight.
   */
  onUploadingChange?: (isUploading: boolean) => void;
}

export function CacheImageManager({ images, onImagesChange, disabled = false, className, onUploadingChange }: CacheImageManagerProps) {
  const { t } = useTranslation();
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const { toast } = useToast();
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  // Max upload size: 10 MB. Larger files make Blossom uploads slow and can
  // silently fail on flaky networks.
  const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

  // Track the latest images array in a ref so async callbacks (upload
  // success/failure) can update based on the *current* state, not the
  // snapshot captured when the handler fired. This fixes a stale-closure
  // bug where a second upload could overwrite the first.
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // Notify parent whenever upload activity changes so it can gate Publish.
  useEffect(() => {
    onUploadingChange?.(isUploading || uploadingIndex !== null);
  }, [isUploading, uploadingIndex, onUploadingChange]);

  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: t('createCache.form.image.invalidFileType.title'),
        description: t('createCache.form.image.invalidFileType.description'),
        variant: "destructive",
      });
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      toast({
        title: t('createCache.form.image.tooLarge.title', 'Image too large'),
        description: t('createCache.form.image.tooLarge.description', {
          mb: Math.round(MAX_IMAGE_BYTES / (1024 * 1024)),
          defaultValue: 'Pick an image under {{mb}} MB.',
        }),
        variant: 'destructive',
      });
      return;
    }

    // Show uploading toast
    toast({
      title: "Uploading image...",
      description: `Uploading ${file.name}...`,
    });

    // Unique placeholder marker so we can locate and replace/remove this
    // specific upload's slot even if other uploads complete in the meantime.
    const placeholder = `__uploading__${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setUploadingIndex(imagesRef.current.length);
    onImagesChange([...imagesRef.current, placeholder]);

    try {
      const [[_, url]] = await uploadFile(file);
      // Replace only our placeholder; concurrent changes are preserved.
      onImagesChange(imagesRef.current.map((v) => (v === placeholder ? url : v)));
      toast({
        title: "Success",
        description: "Image uploaded successfully",
      });
    } catch (error) {
      const errorObj = error as { message?: string };
      // Remove only our placeholder on error.
      onImagesChange(imagesRef.current.filter((v) => v !== placeholder));

      toast({
        title: t('createCache.form.image.uploadFailed.title'),
        description: errorObj.message || t('createCache.form.image.uploadFailed.description'),
        variant: "destructive",
      });
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await processFile(file);
    } finally {
      e.target.value = '';
    }
  };

  // On native (Capacitor) the WebView's file chooser ignores the `capture`
  // attribute, so tapping "Camera" goes straight to the gallery. Use the
  // Capacitor Camera plugin to launch the native camera intent directly.
  const handleCameraCapture = async () => {
    try {
      const photo = await CapCamera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.Uri,
        quality: 85,
        // Allow user to crop/rotate before returning. Set to false for raw shot.
        allowEditing: false,
        // Avoid saving to gallery; cache image goes straight to upload.
        saveToGallery: false,
      });

      if (!photo.webPath) return;

      const response = await fetch(photo.webPath);
      const blob = await response.blob();
      const ext = (photo.format || 'jpg').toLowerCase();
      const file = new File([blob], `cache-photo-${Date.now()}.${ext}`, {
        type: blob.type || `image/${ext}`,
      });
      await processFile(file);
    } catch (error) {
      const errorObj = error as { message?: string };
      // User cancelled — silently ignore.
      if (errorObj.message?.toLowerCase().includes('cancel')) return;
      toast({
        title: t('createCache.form.image.uploadFailed.title'),
        description: errorObj.message || t('createCache.form.image.uploadFailed.description'),
        variant: "destructive",
      });
    }
  };

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) return;
    const newImages = [...images];
    const [moved] = newImages.splice(dragIndex, 1);
    newImages.splice(index, 0, moved);
    onImagesChange(newImages);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // Touch-based reorder for mobile
  const [touchIndex, setTouchIndex] = useState<number | null>(null);

  const handleTouchHold = (index: number) => {
    if (touchIndex === null) {
      setTouchIndex(index);
    } else if (touchIndex !== index) {
      // Swap
      const newImages = [...images];
      const [moved] = newImages.splice(touchIndex, 1);
      newImages.splice(index, 0, moved);
      onImagesChange(newImages);
      setTouchIndex(null);
    } else {
      setTouchIndex(null);
    }
  };

  return (
    <div className={cn("space-y-3 text-foreground", className)}>
      <Label>Images</Label>
      {images.length > 1 && (
        <p className="text-xs text-muted-foreground -mt-1">
          {touchIndex !== null
            ? 'Tap another image to swap positions'
            : 'Drag to reorder · tap and hold on mobile'}
        </p>
      )}

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((url, index) => (
            <div
              key={url || index}
              draggable={!disabled && uploadingIndex === null && images.length > 1 && !!url}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              onClick={() => images.length > 1 && url && handleTouchHold(index)}
              className={cn(
                "group relative aspect-square rounded-lg overflow-hidden bg-muted border transition-all cursor-grab active:cursor-grabbing",
                dragIndex === index && "opacity-40 scale-95",
                dragOverIndex === index && dragIndex !== index && "ring-2 ring-primary scale-[1.02]",
                touchIndex === index && "ring-2 ring-primary",
              )}
            >
              {url && !url.startsWith('__uploading__') ? (
                <img
                  src={url}
                  alt={`Cache image ${index + 1}`}
                  className="w-full h-full object-cover pointer-events-none select-none"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                </div>
              )}
              {/* Overlay controls */}
              <div className="absolute inset-0">
                {/* Remove button */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeImage(index); }}
                  disabled={disabled || uploadingIndex === index}
                  aria-label={`Remove cache image ${index + 1}`}
                  className="absolute top-1 right-1 h-6 w-6 inline-flex items-center justify-center bg-black/60 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload area — on native (Capacitor) we use the Camera plugin for the
          camera button so it launches the native camera intent directly; the
          WebView's file chooser ignores `capture` and would otherwise route
          to the gallery. The library button always uses a standard file input. */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageUpload}
        disabled={disabled || isUploading}
        className="hidden"
        id="cache-image-upload-camera"
      />
      <input
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        disabled={disabled || isUploading}
        className="hidden"
        id="cache-image-upload-library"
      />
      {isUploading ? (
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 py-6 px-4 opacity-50"
          )}
        >
          <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
          <span className="text-sm text-muted-foreground">Uploading...</span>
        </div>
      ) : (
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 py-6 px-4",
            disabled && "pointer-events-none opacity-50"
          )}
        >
          <div className="flex items-stretch gap-3 text-muted-foreground">
            {Capacitor.isNativePlatform() ? (
              <button
                type="button"
                onClick={handleCameraCapture}
                disabled={disabled}
                className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
              >
                <Camera className="h-5 w-5" />
                <span className="text-sm">Camera</span>
              </button>
            ) : (
              <Label
                htmlFor="cache-image-upload-camera"
                className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted hover:text-foreground transition-colors"
              >
                <Camera className="h-5 w-5" />
                <span className="text-sm">Camera</span>
              </Label>
            )}
            <span className="self-center text-muted-foreground/30">|</span>
            <Label
              htmlFor="cache-image-upload-library"
              className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted hover:text-foreground transition-colors"
            >
              <ImagePlus className="h-5 w-5" />
              <span className="text-sm">Library</span>
            </Label>
          </div>
          <span className="text-xs text-muted-foreground">Take a photo or choose from your library</span>
        </div>
      )}
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

  const updateField = <K extends keyof GeocacheFormData>(field: K, value: GeocacheFormData[K]) => {
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

        <CacheKeyField
          value={formData.key}
          onChange={(value) => updateField('key', value)}
          fieldId={fieldPrefix ? `${fieldPrefix}-key` : 'key'}
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

      {/* Listing Status — always visible to the owner */}
      <div className="space-y-4">
        <div className="border-b pb-2">
          <h3 className="text-lg font-medium text-foreground">Listing Status</h3>
          <p className="text-sm text-muted-foreground">Signal the current state of your cache to seekers</p>
        </div>

        <CacheStatusField
          value={formData.status}
          onChange={(value) => updateField('status', value)}
          fieldId={fieldPrefix ? `${fieldPrefix}-status` : 'status'}
        />
      </div>

      {/* Legacy Hidden toggle — only shown when the cache is already marked hidden.
          `hidden` is a deprecated visibility flag retained for backward compatibility
          with existing listings that opted into it. New caches should use the
          Listing Status above (archived / maintenance) instead. */}
      {formData.hidden && (
        <div className="space-y-4">
          <div className="border-b pb-2">
            <h3 className="text-lg font-medium text-foreground">Visibility (Legacy)</h3>
            <p className="text-sm text-muted-foreground">Control who can find your cache</p>
          </div>

          <CacheHiddenField
            checked={formData.hidden || false}
            onChange={(checked) => updateField('hidden', checked)}
            fieldId={fieldPrefix ? `${fieldPrefix}-hidden` : 'hidden'}
          />
        </div>
      )}
    </div>
  );
}

