// Utility functions for geocache display and formatting

export function getDifficultyLabel(difficulty: number): string {
  const labels = ["", "Easy", "Moderate", "Hard", "Very Hard", "Expert"];
  return labels[difficulty] || "";
}

export function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    traditional: "Traditional",
    multi: "Multi-cache", 
    mystery: "Mystery/Puzzle",
    earth: "EarthCache",
    earthcache: "EarthCache",
  };
  return labels[type.toLowerCase()] || type;
}

export function getSizeLabel(size: string): string {
  return size.charAt(0).toUpperCase() + size.slice(1);
}

export function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    traditional: '📦',
    multi: '🔗',
    mystery: '❓',
    letterbox: '📮',
    event: '📅',
    virtual: '👻',
    earthcache: '🌍',
    earth: '🌍',
    wherigo: '📱',
  };
  return icons[type.toLowerCase()] || '📦';
}