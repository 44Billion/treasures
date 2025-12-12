import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthor } from '@/features/auth/hooks/useAuthor';
import { BlogPost } from '../types';
import { formatDistanceToNow, format } from 'date-fns';
import { Calendar, User, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
    <div className="max-w-6xl mx-auto">
      {/* Back button */}
      <div className="mb-6">
        <Link to="/blog">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            {t('blog.post.backToBlog')}
          </Button>
        </Link>
      </div>

      <Card>
        {post.image && (
          <div className="aspect-video w-full overflow-hidden rounded-t-lg">
            <img 
              src={post.image} 
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold mb-4">{post.title}</h1>
              
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>{displayName}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {format(publishedDate, 'MMMM d, yyyy')} 
                    {' '}({formatDistanceToNow(publishedDate, { addSuffix: true })})
                  </span>
                </div>
              </div>

              {post.summary && (
                <p className="text-lg text-muted-foreground mt-4 italic">
                  {post.summary}
                </p>
              )}
            </div>

            {showAuthorActions && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit?.(post)}
                  className="gap-2"
                >
                  <Edit className="w-4 h-4" />
                  {t('common.edit')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete?.(post)}
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('common.delete')}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {/* Content */}
          <div className="prose prose-gray dark:prose-invert max-w-none mb-8">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                // Customize link rendering to handle external links
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
                // Customize image rendering
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
            <div className="flex flex-wrap gap-2 pt-6 border-t">
              {post.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  #{tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}