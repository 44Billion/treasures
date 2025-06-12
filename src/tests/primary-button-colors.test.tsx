import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'next-themes';
import { Button } from '@/components/ui/button';

function TestWrapper({ children, theme = 'light' }: { children: React.ReactNode; theme?: string }) {
  return (
    <ThemeProvider attribute="class" defaultTheme={theme} enableSystem={false}>
      {children}
    </ThemeProvider>
  );
}

describe('Primary Button Colors', () => {
  it('should have proper primary button styling in light theme', () => {
    render(
      <TestWrapper theme="light">
        <Button variant="default">Primary Button</Button>
      </TestWrapper>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-primary');
    expect(button).toHaveClass('text-primary-foreground');
    expect(button).toHaveClass('hover:bg-primary/90');
  });

  it('should have proper primary button styling in dark theme', () => {
    render(
      <TestWrapper theme="dark">
        <Button variant="default">Primary Button</Button>
      </TestWrapper>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-primary');
    expect(button).toHaveClass('text-primary-foreground');
    expect(button).toHaveClass('hover:bg-primary/90');
  });

  it('should render button text correctly', () => {
    render(
      <TestWrapper>
        <Button variant="default">Test Button</Button>
      </TestWrapper>
    );

    expect(screen.getByText('Test Button')).toBeInTheDocument();
  });

  it('should support other button variants', () => {
    render(
      <TestWrapper>
        <Button variant="secondary">Secondary Button</Button>
        <Button variant="outline">Outline Button</Button>
        <Button variant="ghost">Ghost Button</Button>
      </TestWrapper>
    );

    const secondaryButton = screen.getByText('Secondary Button');
    const outlineButton = screen.getByText('Outline Button');
    const ghostButton = screen.getByText('Ghost Button');

    expect(secondaryButton).toHaveClass('bg-secondary');
    expect(outlineButton).toHaveClass('border');
    expect(ghostButton).toHaveClass('hover:bg-accent');
  });
});