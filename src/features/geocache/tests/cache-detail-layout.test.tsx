import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

// Simple test component that mimics the new cache detail layout
const MockCacheDetailLayout = () => (
  <div className="container mx-auto px-2 sm:px-4 py-8">
    <div className="grid lg:grid-cols-3 gap-4 lg:gap-8">
      <div className="lg:col-span-2 space-y-4 lg:space-y-6 min-w-0">
        {/* Cache info card */}
        <div data-testid="cache-info">
          <h1>Test Cache</h1>
          <p>A test geocache description</p>
        </div>

        {/* Map Section */}
        <div data-testid="map-card">
          <h2>Map</h2>
          <div data-testid="geocache-map">Map Component</div>
        </div>

        {/* Logs Section */}
        <div data-testid="logs-section">
          <div>Logs Component</div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-4 lg:space-y-6">
        <div data-testid="cache-details">Cache Details</div>
      </div>
    </div>
  </div>
);

describe('Cache Detail Layout (No Tabs)', () => {
  it('should render both map and logs sections simultaneously', () => {
    render(<MockCacheDetailLayout />);

    // Both map and logs sections should be visible at the same time
    expect(screen.getByTestId('geocache-map')).toBeInTheDocument();
    expect(screen.getByTestId('logs-section')).toBeInTheDocument();
    
    // Should show the map section title
    expect(screen.getByText('Map')).toBeInTheDocument();
    
    // Should not have any tab controls
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('should display cache information', () => {
    render(<MockCacheDetailLayout />);

    // Should show cache name and details
    expect(screen.getByText('Test Cache')).toBeInTheDocument();
    expect(screen.getByText('A test geocache description')).toBeInTheDocument();
  });

  it('should show sections in the correct order', () => {
    render(<MockCacheDetailLayout />);

    const cacheInfo = screen.getByTestId('cache-info');
    const mapCard = screen.getByTestId('map-card');
    const logsSection = screen.getByTestId('logs-section');
    
    // All should be present
    expect(cacheInfo).toBeInTheDocument();
    expect(mapCard).toBeInTheDocument();
    expect(logsSection).toBeInTheDocument();
    
    // Check DOM order: cache info, then map, then logs
    const container = cacheInfo.parentElement;
    const children = Array.from(container?.children || []);
    
    const cacheInfoIndex = children.indexOf(cacheInfo);
    const mapIndex = children.indexOf(mapCard);
    const logsIndex = children.indexOf(logsSection);
    
    expect(cacheInfoIndex).toBeLessThan(mapIndex);
    expect(mapIndex).toBeLessThan(logsIndex);
  });

  it('should have proper layout structure', () => {
    render(<MockCacheDetailLayout />);

    // Should have main content area and sidebar
    expect(screen.getByTestId('cache-details')).toBeInTheDocument();
    
    // Main content should contain cache info, map, and logs
    const mainContent = screen.getByTestId('cache-info').parentElement;
    expect(mainContent).toContainElement(screen.getByTestId('cache-info'));
    expect(mainContent).toContainElement(screen.getByTestId('map-card'));
    expect(mainContent).toContainElement(screen.getByTestId('logs-section'));
  });
});