import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { BookOpen, Calendar } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthor } from '@/hooks/useAuthor';
import { formatDistanceToNow } from '@/utils/date';
import { extractExcerpt } from '@/utils/blogUtils';
import { cn } from '@/lib/utils';
import type { BlogPost } from '@/types/blog';

function Byline({
  pubkey,
  publishedAt,
  className,
}: {
  pubkey: string;
  publishedAt: number;
  className?: string;
}) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;
  const name = metadata?.display_name || metadata?.name || pubkey.slice(0, 8);

  return (
    <div className={cn('flex items-center gap-2 text-xs text-white/80', className)}>
      <Avatar className="w-5 h-5">
        <AvatarImage src={metadata?.picture} alt={name} />
        <AvatarFallback className="text-[9px]">
          {name.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="font-medium">{name}</span>
      <span className="text-white/40">·</span>
      <span className="inline-flex items-center gap-1">
        <Calendar className="w-3 h-3" />
        {formatDistanceToNow(new Date(publishedAt * 1000), { addSuffix: true })}
      </span>
    </div>
  );
}

/**
 * Full-art story card: image fills the card, text overlays at the bottom.
 * `featured` makes it taller/bolder for the lead story.
 */
function StoryCard({ post, featured = false }: { post: BlogPost; featured?: boolean }) {
  const { t } = useTranslation();
  const excerpt = post.summary || extractExcerpt(post.content, featured ? 160 : 110);

  return (
    <Link
      to={`/blog/${post.pubkey}/${post.dTag}`}
      className={cn(
        'group relative flex flex-col justify-end overflow-hidden rounded-2xl border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/10',
        featured ? 'min-h-[22rem] md:min-h-full' : 'min-h-[14rem]',
      )}
    >
      {post.image ? (
        <img
          src={post.image}
          alt={post.title}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/5" />
      )}
      {/* Legibility scrim */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />

      <div className={cn('relative space-y-2.5', featured ? 'p-6 md:p-8' : 'p-5')}>
        {featured && (
          <span className="inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
            {t('home.blog.featured')}
          </span>
        )}
        <h4
          className={cn(
            'font-bold leading-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.5)] line-clamp-3 group-hover:text-green-200 transition-colors',
            featured ? 'text-xl md:text-3xl' : 'text-base md:text-lg',
          )}
        >
          {post.title}
        </h4>
        {featured && (
          <p className="hidden md:block text-sm text-white/80 line-clamp-2 max-w-xl">
            {excerpt}
          </p>
        )}
        <Byline pubkey={post.pubkey} publishedAt={post.publishedAt} />
      </div>
    </Link>
  );
}

export function BlogShowcase({ posts }: { posts: BlogPost[] }) {
  const { t } = useTranslation();
  if (posts.length === 0) return null;

  const [lead, ...rest] = posts;
  const secondary = rest.slice(0, 2);

  return (
    <section className="relative py-6 xs:py-12 md:py-16 px-3 xs:px-4">
      <div className="container mx-auto relative z-10">
        {/* Section Header — matches the rest of the home page */}
        <div className="text-center mb-8 md:mb-12">
          <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            {t('home.blog.title')}
          </h3>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t('home.blog.description')}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 md:auto-rows-fr">
          <StoryCard post={lead} featured />

          {secondary.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-1">
              {secondary.map((post) => (
                <StoryCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-center mt-8 md:mt-12">
          <Link to="/blog">
            <Button variant="outline" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              {t('home.blog.viewAll')}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
