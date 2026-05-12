export interface GeocacheFormData {
  name: string;
  description: string;
  hint: string;
  /** Optional "Quest": a requirement to claim this treasure. */
  key: string;
  difficulty: string;
  terrain: string;
  size: string;
  type: string;
  hidden?: boolean;
  status?: 'archived' | 'maintenance';
  contentWarning?: string;
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