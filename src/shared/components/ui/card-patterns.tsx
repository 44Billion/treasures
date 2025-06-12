import React, { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/shared/utils/utils';

// Feature Card - Used for main features/benefits (like in Home page)
interface FeatureCardProps {
  icon: LucideIcon;
  title: string | ReactNode;
  description: string | ReactNode;
  iconColor?: string;
  centered?: boolean;
  className?: string;
}

export function FeatureCard({ 
  icon: Icon, 
  title, 
  description, 
  iconColor = "text-green-600 adventure:text-amber-600",
  centered = false,
  className 
}: FeatureCardProps) {
  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className={cn(centered ? "text-center" : "", "md:text-left")}>
        <Icon className={cn(`h-10 w-10 mb-4`, iconColor, centered ? "mx-auto md:mx-0" : "")} />
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  );
}

// Info Card - Used for displaying information with optional action
interface InfoCardProps {
  icon?: LucideIcon;
  title: string;
  description?: string | ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function InfoCard({ 
  icon: Icon, 
  title, 
  description, 
  children, 
  action, 
  className 
}: InfoCardProps) {
  return (
    <Card className={cn("text-center", className)}>
      <CardContent className="pt-6">
        {Icon && <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />}
        <p className="text-lg font-medium mb-2">{title}</p>
        {description && (
          <p className="text-muted-foreground mb-4">{description}</p>
        )}
        {children}
        {action && (
          <div className="flex justify-center">{action}</div>
        )}
      </CardContent>
    </Card>
  );
}

// Details Card - Used for displaying details in sidebar/info sections
interface DetailsCardProps {
  title: string | ReactNode;
  children: ReactNode;
  className?: string;
}

export function DetailsCard({ title, children, className }: DetailsCardProps) {
  return (
    <Card className={className}>
      <CardContent className="p-4 space-y-3">
        <h4 className="font-medium">{title}</h4>
        {children}
      </CardContent>
    </Card>
  );
}

// Stats Card - Used for displaying statistics
interface StatsCardProps {
  title: string;
  stats: Array<{
    label: string;
    value: string | number;
    className?: string;
  }>;
  className?: string;
}

export function StatsCard({ title, stats, className }: StatsCardProps) {
  return (
    <DetailsCard title={title} className={className}>
      <div className="space-y-1">
        {stats.map(({ label, value, className: statClassName }, index) => (
          <div key={index} className="flex justify-between">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className={cn("text-xs font-medium", statClassName)}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </DetailsCard>
  );
}

// Interactive Card - Used for clickable cards with hover effects
interface InteractiveCardProps {
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  compact?: boolean;
}

export function InteractiveCard({ 
  onClick, 
  children, 
  className, 
  compact = false 
}: InteractiveCardProps) {
  return (
    <Card 
      className={cn(
        "transition-shadow",
        onClick ? "cursor-pointer hover:shadow-lg" : "",
        compact ? "hover:shadow-md" : "h-full hover:shadow-lg",
        className
      )}
      onClick={onClick}
    >
      {children}
    </Card>
  );
}

// Empty State Card - Used when no content is available
interface EmptyStateCardProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyStateCard({ 
  icon: Icon, 
  title, 
  description, 
  action, 
  className 
}: EmptyStateCardProps) {
  return (
    <Card className={className}>
      <CardContent className="text-center py-12">
        {Icon && <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />}
        <p className="text-lg font-medium mb-2">{title}</p>
        {description && <p className="text-muted-foreground mb-4">{description}</p>}
        {action && (
          <div className="flex justify-center">{action}</div>
        )}
      </CardContent>
    </Card>
  );
}