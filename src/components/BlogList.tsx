import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageLoading } from '@/components/ui/loading';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBlogPosts, useIsAuthorizedAuthor } from '../hooks/useBlogPosts';
import { useDeleteBlogPost } from '../hooks/useBlogPublish';
import { BlogPostCard } from './BlogPostCard';
import { BlogPostEditor } from './BlogPostEditor';
import { BlogPost } from '@/types/blog';
import {
  TAG_SUGGESTION_LIMIT,
} from '@/config/blog';
import { Plus, Search, Filter } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function BlogList() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const { data: posts, isLoading, error } = useBlogPosts();
  const deleteMutation = useDeleteBlogPost();
  
  const isAuthorized = useIsAuthorizedAuthor(user?.pubkey);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [deletingPost, setDeletingPost] = useState<BlogPost | null>(null);

  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);

  // Filter posts based on search and tag
  const filteredPosts = posts?.filter(post => {
    const matchesSearch = !searchTerm || 
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.content.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTag = !selectedTag || post.tags.includes(selectedTag);
    
    return matchesSearch && matchesTag;
  }) || [];

  // Get all unique tags from posts - memoized for performance
  const allTags = useMemo(() => {
    return Array.from(
      new Set(posts?.flatMap(post => post.tags) || [])
    ).sort();
  }, [posts]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (value) {
      const suggestions = allTags
        .filter(tag => tag.toLowerCase().startsWith(value.toLowerCase()))
        .slice(0, TAG_SUGGESTION_LIMIT);
      setTagSuggestions(suggestions);
    } else {
      setTagSuggestions([]);
    }
  };

  const handleTagSuggestionClick = (tag: string) => {
    setSelectedTag(tag);
    setSearchTerm('');
    setTagSuggestions([]);
  };

  const handleEdit = (post: BlogPost) => {
    setEditingPost(post);
    setShowEditor(true);
  };

  const handleDelete = (post: BlogPost) => {
    setDeletingPost(post);
  };

  const confirmDelete = async () => {
    if (!deletingPost) return;

    try {
      await deleteMutation.mutateAsync({
        eventId: deletingPost.id,
        reason: 'Blog post deleted by author',
      });
      
      toast({
        title: t('blog.delete.success.title'),
        description: t('blog.delete.success.description'),
      });
    } catch (error) {
      const errorObj = error as { message?: string };
      toast({
        title: t('blog.delete.error.title'),
        description: errorObj.message || t('blog.delete.error.description'),
        variant: 'destructive',
      });
    } finally {
      setDeletingPost(null);
    }
  };

  const handleEditorSave = () => {
    setShowEditor(false);
    setEditingPost(null);
  };

  const handleEditorCancel = () => {
    setShowEditor(false);
    setEditingPost(null);
  };

  if (showEditor) {
    return (
      <BlogPostEditor
        post={editingPost || undefined}
        onSave={handleEditorSave}
        onCancel={handleEditorCancel}
      />
    );
  }

  if (isLoading) {
    return (
      <PageLoading 
        title={t('blog.loading.title')}
        description={t('blog.loading.description')}
        className="[&_p]:text-white/80 adventure:[&_p]:text-stone-600"
      />
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <h3 className="text-lg font-semibold mb-2">{t('blog.error.title')}</h3>
        <p className="text-muted-foreground">
          {t('blog.error.description')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* New Post button (authorized users) */}
      {isAuthorized && (
        <div className="flex justify-center">
          <Button onClick={() => setShowEditor(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            {t('blog.newPost')}
          </Button>
        </div>
      )}

      {/* Search and Filters card (admin only) */}
      {isAuthorized && (
        <div className="rounded-xl border bg-card p-4 md:p-5 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('blog.search.placeholder')}
              value={searchTerm}
              onChange={handleSearchChange}
              className="pl-10"
            />
            {tagSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg">
                <ul className="py-1">
                  {tagSuggestions.map(tag => (
                    <li
                      key={tag}
                      className="px-3 py-2 cursor-pointer hover:bg-muted"
                      onClick={() => handleTagSuggestionClick(tag)}
                    >
                      #{tag}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          {allTags.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex flex-nowrap gap-1.5">
                <Badge
                  variant={selectedTag === null ? "default" : "outline"}
                  className="cursor-pointer flex-shrink-0"
                  onClick={() => setSelectedTag(null)}
                >
                  {t('blog.filters.all')}
                </Badge>
                {allTags.slice(0, 10).map(tag => (
                  <Badge
                    key={tag}
                    variant={selectedTag === tag ? "default" : "outline"}
                    className="cursor-pointer flex-shrink-0"
                    onClick={() => setSelectedTag(tag)}
                  >
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Posts */}
      {filteredPosts.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <h3 className="text-lg font-semibold mb-2">{t('blog.empty.title')}</h3>
          <p className="text-muted-foreground">
            {searchTerm || selectedTag 
              ? t('blog.empty.descriptionFiltered')
              : t('blog.empty.descriptionNoPosts')
            }
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredPosts.map((post) => (
            <BlogPostCard
              key={post.id}
              post={post}
              showAuthorActions={isAuthorized && post.pubkey === user?.pubkey}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingPost} onOpenChange={() => setDeletingPost(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('blog.delete.confirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('blog.delete.confirm.description', { title: deletingPost?.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
