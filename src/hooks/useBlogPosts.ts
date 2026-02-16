import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { TIMEOUTS } from '@/config';
import { BLOG_CONFIG, BLOG_POST_KIND, BLOG_TAG, BLOG_CACHE_TIMES, BLOG_QUERY_LIMITS } from '@/config/blog';
import { eventToBlogPost } from '../utils/blogUtils';
import { BlogPost } from '@/types/blog';

/**
 * Hook to fetch all blog posts with the #treasures tag
 */
export function useBlogPosts() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['blog', 'posts'],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      
      const events = await nostr.query([
        {
          kinds: [BLOG_POST_KIND],
          '#t': [BLOG_TAG],
          limit: BLOG_QUERY_LIMITS.RECENT_POSTS,
        }
      ], { signal });

      const posts: BlogPost[] = [];
      
      for (const event of events) {
        const post = eventToBlogPost(event);
        if (post) {
          posts.push(post);
        }
      }

      // Sort by published date (newest first)
      return posts.sort((a, b) => b.publishedAt - a.publishedAt);
    },
    staleTime: BLOG_CACHE_TIMES.POSTS,
    gcTime: BLOG_CACHE_TIMES.POSTS * 2,
  });
}

/**
 * Hook to fetch a single blog post by author and d tag
 */
export function useBlogPost(pubkey: string, dTag: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['blog', 'post', pubkey, dTag],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      
      const events = await nostr.query([
        {
          kinds: [BLOG_POST_KIND],
          authors: [pubkey],
          '#d': [dTag],
          '#t': [BLOG_TAG],
          limit: 1,
        }
      ], { signal });

      if (events.length === 0) {
        return null;
      }

      return events[0] ? eventToBlogPost(events[0]) : null;
    },
    staleTime: BLOG_CACHE_TIMES.SINGLE_POST,
    gcTime: BLOG_CACHE_TIMES.SINGLE_POST * 2,
    enabled: !!pubkey && !!dTag,
  });
}

/**
 * Hook to check if current user is an authorized author
 */
export function useIsAuthorizedAuthor(pubkey?: string) {
  if (!pubkey) {
    return false;
  }
  
  return BLOG_CONFIG.authorizedAuthors.includes(pubkey);
}