import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuthor } from '@/hooks/useAuthor';
import { BlogPost } from '@/types/blog';
import { formatDistanceToNow } from '@/utils/date';
import { Calendar, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface BlogPostDetailProps {
  post: BlogPost;
  showAuthorActions?: boolean;
  onEdit?: (post: BlogPost) => void;
  onDelete?: (post: BlogPost) => void;
}

export function BlogPostDetail({ 
  post, 
  showAuthorActions = false, 
  onEdit, 
  onDelete 
}: BlogPostDetailProps) {
  const { t } = useTranslation();
  const author = useAuthor(post.pubkey);
  const metadata = author.data?.metadata;

  const displayName = metadata?.display_name || metadata?.name || post.pubkey.slice(0, 8);
  const publishedDate = new Date(post.publishedAt * 1000);

  return (
    <div className="space-y-4">
      {/* Back button */}
      <div>
        <Link to="/blog">
          <Button variant="ghost" size="sm" className="gap-2 text-white/80 hover:text-white hover:bg-white/10 adventure:text-stone-600 adventure:hover:text-stone-800 adventure:hover:bg-stone-700/10">
            <ArrowLeft className="w-4 h-4" />
            {t('blog.post.backToBlog')}
          </Button>
        </Link>
      </div>

      {/* Main content card */}
      <div className="rounded-xl border border-white/15 bg-white/10 backdrop-blur-sm overflow-hidden adventure:border-stone-400/30 adventure:bg-stone-100/20">
        {post.image && (
          <div className="aspect-video w-full overflow-hidden">
            <img 
              src={post.image} 
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        <div className="p-5 md:p-6">
          {/* Author actions + metadata */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 text-xs md:text-sm text-white/70 adventure:text-stone-500">
              <div className="flex items-center gap-1.5">
                <Avatar className="w-5 h-5">
                  <AvatarImage src={metadata?.picture} alt={displayName} />
                  <AvatarFallback className="text-[10px]">{displayName.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span>{displayName}</span>
              </div>
              
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(publishedDate)} 
                  {' '}({formatDistanceToNow(publishedDate, { addSuffix: true })})
                </span>
              </div>
            </div>

            {showAuthorActions && (
              <div className="flex gap-1.5 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit?.(post)}
                  className="gap-2 border border-white/20 text-white/80 hover:text-white hover:bg-white/10 adventure:border-stone-400/40 adventure:text-stone-600 adventure:hover:text-stone-800 adventure:hover:bg-stone-700/10"
                >
                  <Edit className="w-4 h-4" />
                  {t('common.edit')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete?.(post)}
                  className="gap-2 border border-white/20 text-white/80 hover:text-white hover:bg-white/10 adventure:border-stone-400/40 adventure:text-stone-600 adventure:hover:text-stone-800 adventure:hover:bg-stone-700/10"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('common.delete')}
                </Button>
              </div>
            )}
          </div>

          {post.summary && (
            <p className="text-sm md:text-base text-white/70 adventure:text-stone-500 mt-4 italic">
              {post.summary}
            </p>
          )}

          {/* Content */}
          <div className="prose prose-invert max-w-none mt-6 prose-a:text-white prose-a:underline prose-strong:text-white adventure:prose-headings:text-stone-800 adventure:prose-p:text-stone-700 adventure:prose-li:text-stone-700 adventure:prose-strong:text-stone-800 adventure:prose-a:text-stone-800">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                a: ({ href, children, ...props }) => {
                  const isExternal = href?.startsWith('http');
                  return (
                    <a 
                      href={href} 
                      target={isExternal ? '_blank' : undefined}
                      rel={isExternal ? 'noopener noreferrer' : undefined}
                      {...props}
                    >
                      {children}
                    </a>
                  );
                },
                img: ({ src, alt, ...props }) => (
                  <img 
                    src={src} 
                    alt={alt} 
                    className="rounded-lg max-w-full h-auto"
                    {...props}
                  />
                ),
              }}
            >
              {post.content}
            </ReactMarkdown>
          </div>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-5 mt-6 border-t border-white/10 adventure:border-stone-400/30">
              {post.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="bg-white/10 text-white/80 border-white/20 adventure:bg-stone-700/10 adventure:text-stone-600 adventure:border-stone-400/30">
                  #{tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
