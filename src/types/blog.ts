import { NostrEvent } from '@nostrify/nostrify';

export interface BlogPost {
  id: string;
  pubkey: string;
  title: string;
  content: string;
  summary?: string;
  image?: string;
  publishedAt: number;
  createdAt: number;
  tags: string[];
  dTag: string; // The 'd' tag identifier
  event: NostrEvent;
}

export interface CreateBlogPostData {
  title: string;
  content: string;
  summary?: string;
  image?: string;
  tags?: string[];
  dTag?: string; // If not provided, will be auto-generated
}

export interface UpdateBlogPostData extends CreateBlogPostData {
  dTag: string; // Required for updates
}

export interface BlogConfig {
  authorizedAuthors: string[];
  blogTitle: string;
  blogDescription: string;
  blogImage?: string;
}
