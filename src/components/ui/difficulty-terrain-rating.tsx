import { getDifficultyLabel } from '@/lib/geocache-utils';

// Difficulty/terrain rating display component
export function DifficultyTerrainRating({ 
  difficulty, 
  terrain, 
  showLabels = true,
  size = 'default' 
}: { 
  difficulty: number;
  terrain: number;
  showLabels?: boolean;
  size?: 'small' | 'default';
}) {
  const dotSize = size === 'small' ? 'h-3 w-3' : 'h-4 w-4';
  const textSize = size === 'small' ? 'text-xs' : 'text-sm';
  
  return (
    <div className="space-y-2">
      <div>
        <p className={`font-medium text-gray-600 ${textSize}`}>Difficulty</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`${dotSize} rounded ${
                  i <= difficulty ? "bg-green-600" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
          {showLabels && <span className={textSize}>{getDifficultyLabel(difficulty)}</span>}
        </div>
      </div>
      
      <div>
        <p className={`font-medium text-gray-600 ${textSize}`}>Terrain</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`${dotSize} rounded ${
                  i <= terrain ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
          {showLabels && <span className={textSize}>{getDifficultyLabel(terrain)}</span>}
        </div>
      </div>
    </div>
  );
}