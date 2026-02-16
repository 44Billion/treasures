import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthor } from '@/hooks/useAuthor';
import { BlogPost } from '@/types/blog';
import { extractExcerpt } from '../utils/blogUtils';
import { formatDistanceToNow } from '@/utils/date';
import { Calendar, User, Edit, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BlogPostCardProps {
  post: BlogPost;
  showAuthorActions?: boolean;
  onEdit?: (post: BlogPost) => void;
  onDelete?: (post: BlogPost) => void;
}

export function BlogPostCard({ 
  post, 
  showAuthorActions = false, 
  onEdit, 
  onDelete 
}: BlogPostCardProps) {
  const { t } = useTranslation();
  const author = useAuthor(post.pubkey);
  const metadata = author.data?.metadata;

  const displayName = metadata?.display_name || metadata?.name || post.pubkey.slice(0, 8);
  const excerpt = post.summary || extractExcerpt(post.content);
  const publishedDate = new Date(post.publishedAt * 1000);

  return (
    <Card className="h-full flex flex-col">
      {post.image && (
        <div className="aspect-[16/8] w-full overflow-hidden rounded-t-lg">
          <img 
            src={post.image} 
            alt={post.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <CardHeader className="flex-none">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <Link 
              to={`/blog/${post.pubkey}/${post.dTag}`}
              className="block group"
            >
              <h3 className="text-lg font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                {post.title}
              </h3>
            </Link>
            
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <User className="w-4 h-4" />
                <span>{displayName}</span>
              </div>
              
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{formatDistanceToNow(publishedDate, { addSuffix: true })}</span>
              </div>
            </div>
          </div>

          {showAuthorActions && (
            <div className="flex gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit?.(post)}
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete?.(post)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col">
        <p className="text-muted-foreground mb-4 line-clamp-3 flex-1">
          {excerpt}
        </p>

        <div className="flex flex-wrap gap-1">
          {post.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              #{tag}
            </Badge>
          ))}
          {post.tags.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{post.tags.length - 3}
            </Badge>
          )}
        </div>

        <div className="mt-4 text-center">
          <Link to={`/blog/${post.pubkey}/${post.dTag}`}>
            <Button variant="outline" className="w-full sm:w-auto">
              {t('blog.card.readMore')}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
