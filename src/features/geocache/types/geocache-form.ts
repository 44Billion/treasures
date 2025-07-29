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