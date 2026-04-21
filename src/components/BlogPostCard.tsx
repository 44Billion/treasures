import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuthor } from '@/hooks/useAuthor';
import { BlogPost } from '@/types/blog';
import { extractExcerpt } from '../utils/blogUtils';
import { formatDistanceToNow } from '@/utils/date';
import { Calendar, Edit, Trash2 } from 'lucide-react';
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
    <div className="rounded-xl border bg-card overflow-hidden">
      {post.image && (
        <div className="aspect-[16/8] w-full overflow-hidden">
          <img 
            src={post.image} 
            alt={post.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <div className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <Link 
              to={`/blog/${post.pubkey}/${post.dTag}`}
              className="block group"
            >
              <h3 className="text-base md:text-lg font-semibold line-clamp-2 group-hover:text-primary transition-colors text-foreground">
                {post.title}
              </h3>
            </Link>
            
            <div className="flex items-center gap-3 mt-2 text-xs md:text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Avatar className="w-5 h-5">
                  <AvatarImage src={metadata?.picture} alt={displayName} />
                  <AvatarFallback className="text-[10px]">{displayName.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span>{displayName}</span>
              </div>
              
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formatDistanceToNow(publishedDate, { addSuffix: true })}</span>
              </div>
            </div>
          </div>

          {showAuthorActions && (
            <div className="flex gap-1.5 flex-shrink-0">
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

        <p className="text-sm text-muted-foreground mt-3 line-clamp-3">
          {excerpt}
        </p>

        <div className="mt-4">
          <Link to={`/blog/${post.pubkey}/${post.dTag}`}>
            <Button variant="outline" size="sm" className="w-full">
              {t('blog.card.readMore')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
