import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { 
  CacheDifficultyField, 
  CacheTerrainField, 
  CacheSizeField,
  CacheTypeField,
  createDefaultGeocacheFormData
} from '@/components/ui/geocache-form';

describe('Enhanced Geocache Form Components', () => {
  describe('CacheDifficultyField', () => {
    it('should display clickable difficulty levels', () => {
      const mockOnChange = vi.fn();
      render(
        <CacheDifficultyField 
          value="3" 
          onChange={mockOnChange} 
        />
      );

      // Should show all 5 difficulty levels as buttons
      expect(screen.getByText('Easy')).toBeInTheDocument();
      expect(screen.getByText('Moderate')).toBeInTheDocument();
      expect(screen.getByText('Challenging')).toBeInTheDocument();
      expect(screen.getByText('Hard')).toBeInTheDocument();
      expect(screen.getByText('Expert')).toBeInTheDocument();
    });

    it('should show examples for each difficulty level', () => {
      const mockOnChange = () => {};
      render(
        <CacheDifficultyField 
          value="1" 
          onChange={mockOnChange} 
        />
      );

      expect(screen.getByText(/Cache is visible or in an obvious hiding spot/)).toBeInTheDocument();
      expect(screen.getByText(/How hard is it to solve/)).toBeInTheDocument();
    });

    it('should highlight selected difficulty', () => {
      const mockOnChange = () => {};
      render(
        <CacheDifficultyField 
          value="3" 
          onChange={mockOnChange} 
        />
      );

      // The selected button should have the green border class
      const challengingButton = screen.getByText('Challenging').closest('button');
      expect(challengingButton).toHaveClass('border-green-500');
    });
  });

  describe('CacheTerrainField', () => {
    it('should display clickable terrain levels with icons', () => {
      const mockOnChange = () => {};
      render(
        <CacheTerrainField 
          value="2" 
          onChange={mockOnChange} 
        />
      );

      // Should show all terrain levels
      expect(screen.getByText('Easy Walk')).toBeInTheDocument();
      expect(screen.getByText('Light Hike')).toBeInTheDocument();
      expect(screen.getByText('Moderate Hike')).toBeInTheDocument();
      expect(screen.getByText('Difficult Hike')).toBeInTheDocument();
      expect(screen.getByText('Extreme')).toBeInTheDocument();
    });

    it('should show terrain examples', () => {
      const mockOnChange = () => {};
      render(
        <CacheTerrainField 
          value="1" 
          onChange={mockOnChange} 
        />
      );

      expect(screen.getByText(/Sidewalks, parking lots, accessible trails/)).toBeInTheDocument();
      expect(screen.getByText(/How hard is it to reach/)).toBeInTheDocument();
    });
  });

  describe('CacheSizeField', () => {
    it('should display visual size options with Lucide icons', () => {
      const mockOnChange = () => {};
      render(
        <CacheSizeField 
          value="regular" 
          onChange={mockOnChange} 
        />
      );

      // Should show all size options
      expect(screen.getByText('Micro')).toBeInTheDocument();
      expect(screen.getByText('Small')).toBeInTheDocument();
      expect(screen.getByText('Regular')).toBeInTheDocument();
      expect(screen.getByText('Large')).toBeInTheDocument();
      expect(screen.getByText('Other')).toBeInTheDocument();
      
      // Should show container size label
      expect(screen.getByText(/Container size/)).toBeInTheDocument();
    });

    it('should show size examples when selected', () => {
      const mockOnChange = () => {};
      render(
        <CacheSizeField 
          value="regular" 
          onChange={mockOnChange} 
        />
      );

      expect(screen.getByText(/Lock & lock container, shoebox/)).toBeInTheDocument();
    });

    it('should highlight selected size', () => {
      const mockOnChange = () => {};
      render(
        <CacheSizeField 
          value="regular" 
          onChange={mockOnChange} 
        />
      );

      const regularButton = screen.getByText('Regular').closest('button');
      expect(regularButton).toHaveClass('border-purple-500');
    });
  });

  describe('CacheTypeField', () => {
    it('should display cache type options with Lucide icons', () => {
      const mockOnChange = () => {};
      render(
        <CacheTypeField 
          value="traditional" 
          onChange={mockOnChange} 
        />
      );

      // Should show all cache type options (only the 3 supported types)
      expect(screen.getByText('Traditional')).toBeInTheDocument();
      expect(screen.getByText('Mystery/Puzzle')).toBeInTheDocument();
      expect(screen.getByText('Multi-Cache')).toBeInTheDocument();
      
      // Should show cache type label
      expect(screen.getByText(/What type of cache/)).toBeInTheDocument();
    });

    it('should show cache type examples', () => {
      const mockOnChange = () => {};
      render(
        <CacheTypeField 
          value="traditional" 
          onChange={mockOnChange} 
        />
      );

      expect(screen.getByText(/Container hidden at the exact GPS location/)).toBeInTheDocument();
    });

    it('should highlight selected cache type', () => {
      const mockOnChange = () => {};
      render(
        <CacheTypeField 
          value="traditional" 
          onChange={mockOnChange} 
        />
      );

      const traditionalButton = screen.getByText('Traditional').closest('button');
      expect(traditionalButton).toHaveClass('border-orange-500');
    });
  });

  describe('Form Data Utilities', () => {
    it('should create default form data with proper values', () => {
      const defaultData = createDefaultGeocacheFormData();
      
      expect(defaultData.name).toBe('');
      expect(defaultData.description).toBe('');
      expect(defaultData.hint).toBe('');
      expect(defaultData.difficulty).toBe('1'); // Default difficulty
      expect(defaultData.terrain).toBe('1'); // Default terrain
      expect(defaultData.size).toBe('regular'); // Default size
      expect(defaultData.type).toBe('traditional'); // Default type
      expect(defaultData.hidden).toBe(false);
    });
  });
});