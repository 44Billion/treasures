import type { BlogConfig } from '@/types/blog';

// Configuration for the Treasures blog
export const BLOG_CONFIG: BlogConfig = {
  authorizedAuthors: [
    '86184109eae937d8d6f980b4a0b46da4ef0d983eade403ee1b4c0b6bde238b47', // @chad@chadwick.site
  ],
  blogTitle: 'Treasures Blog',
  blogDescription: 'Updates and adventures from the community',
  blogImage: '/icon-512x512.png',
};

export const BLOG_POST_KIND = 30023;

export const BLOG_TAG = 'treasures';

export const BLOG_QUERY_LIMITS = {
  POSTS_PER_PAGE: 10,
  RECENT_POSTS: 20,
  AUTHOR_POSTS: 50,
} as const;

export const BLOG_CACHE_TIMES = {
  POSTS: 5 * 60 * 1000,
  AUTHORS: 10 * 60 * 1000,
  SINGLE_POST: 2 * 60 * 1000,
} as const;

export const TAG_SUGGESTION_LIMIT = 5;
