import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FilterButton } from '@/components/FilterButton';

describe('FilterButton', () => {
  const defaultProps = {
    difficulty: undefined,
    difficultyOperator: 'all' as const,
    onDifficultyChange: vi.fn(),
    onDifficultyOperatorChange: vi.fn(),
    terrain: undefined,
    terrainOperator: 'all' as const,
    onTerrainChange: vi.fn(),
    onTerrainOperatorChange: vi.fn(),
    cacheType: undefined,
    onCacheTypeChange: vi.fn(),
  };

  it('should render filter button', () => {
    render(<FilterButton {...defaultProps} />);
    
    expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();
  });

  it('should show active filter count when filters are applied', () => {
    render(
      <FilterButton 
        {...defaultProps} 
        difficulty={3}
        terrain={2}
        cacheType="traditional"
      />
    );
    
    // Should show badge with count of 3 active filters
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should open popover when clicked', () => {
    render(<FilterButton {...defaultProps} />);
    
    const button = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(button);
    
    expect(screen.getByText('Difficulty')).toBeInTheDocument();
    expect(screen.getByText('Terrain')).toBeInTheDocument();
    expect(screen.getByText('Cache Type')).toBeInTheDocument();
  });

  it('should show clear all button when filters are active', () => {
    render(
      <FilterButton 
        {...defaultProps} 
        difficulty={3}
      />
    );
    
    const button = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(button);
    
    expect(screen.getByText('Clear all')).toBeInTheDocument();
  });

  it('should call clear functions when clear all is clicked', () => {
    const props = {
      ...defaultProps,
      difficulty: 3,
      onDifficultyChange: vi.fn(),
      onDifficultyOperatorChange: vi.fn(),
      onTerrainChange: vi.fn(),
      onTerrainOperatorChange: vi.fn(),
      onCacheTypeChange: vi.fn(),
    };

    render(<FilterButton {...props} />);
    
    const button = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(button);
    
    const clearButton = screen.getByText('Clear all');
    fireEvent.click(clearButton);
    
    expect(props.onDifficultyChange).toHaveBeenCalledWith(undefined);
    expect(props.onDifficultyOperatorChange).toHaveBeenCalledWith('all');
    expect(props.onTerrainChange).toHaveBeenCalledWith(undefined);
    expect(props.onTerrainOperatorChange).toHaveBeenCalledWith('all');
    expect(props.onCacheTypeChange).toHaveBeenCalledWith(undefined);
  });

  it('should render in compact mode', () => {
    render(<FilterButton {...defaultProps} compact />);
    
    const button = screen.getByRole('button');
    // In compact mode, should only show the filter icon, not the "Filters" text
    expect(button).not.toHaveTextContent('Filters');
  });
});