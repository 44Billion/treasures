import { getDifficultyLabel, getSizeLabel, getSizeLevel } from '@/features/geocache/utils/geocache-utils';
import { useTheme } from 'next-themes';

// Difficulty/terrain/size rating display component
export function DifficultyTerrainRating({ 
  difficulty, 
  terrain, 
  cacheSize,
  showLabels = true,
  size = 'default' 
}: { 
  difficulty: number;
  terrain: number;
  cacheSize?: string;
  showLabels?: boolean;
  size?: 'small' | 'default';
}) {
  const { theme } = useTheme();
  const isAdventureTheme = theme === 'adventure';
  
  const dotSize = size === 'small' ? 'h-3 w-3' : 'h-4 w-4';
  const textSize = size === 'small' ? 'text-xs' : 'text-sm';
  const sizeLevel = cacheSize ? getSizeLevel(cacheSize) : 0;
  
  // Use more neutral colors in adventure mode
  const difficultyActiveColor = isAdventureTheme ? "bg-stone-600" : "bg-green-600";
  const terrainActiveColor = isAdventureTheme ? "bg-stone-500" : "bg-blue-600";
  const sizeActiveColor = isAdventureTheme ? "bg-stone-400" : "bg-purple-600";
  const inactiveColor = isAdventureTheme ? "bg-stone-200" : "bg-gray-200";
  
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
                  i <= difficulty ? difficultyActiveColor : inactiveColor
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
                  i <= terrain ? terrainActiveColor : inactiveColor
                }`}
              />
            ))}
          </div>
          {showLabels && <span className={textSize}>{getDifficultyLabel(terrain)}</span>}
        </div>
      </div>
      
      {cacheSize && (
        <div>
          <p className={`font-medium text-gray-600 ${textSize}`}>Size</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex gap-1 items-end">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`rounded ${
                    i <= sizeLevel ? sizeActiveColor : inactiveColor
                  } ${
                    // Different sizes for each level to represent cache size visually
                    i === 1 ? (size === 'small' ? 'h-2 w-2' : 'h-3 w-3') :
                    i === 2 ? (size === 'small' ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5') :
                    i === 3 ? (size === 'small' ? 'h-3 w-3' : 'h-4 w-4') :
                    (size === 'small' ? 'h-3.5 w-3.5' : 'h-5 w-5')
                  }`}
                />
              ))}
            </div>
            {showLabels && <span className={textSize}>{getSizeLabel(cacheSize)}</span>}
          </div>
        </div>
      )}
    </div>
  );
}