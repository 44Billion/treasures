import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen } from 'lucide-react';
import { DesktopHeader } from '@/components/DesktopHeader';
import { PageHero } from '@/components/PageHero';
import { PageLoading } from '@/components/ui/loading';
import { BlogPostDetail } from '@/components/BlogPostDetail';
import { BlogPostEditor } from '@/components/BlogPostEditor';
import { useBlogPost, useIsAuthorizedAuthor } from '@/hooks/useBlogPosts';
import { useDeleteBlogPost } from '@/hooks/useBlogPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useState } from 'react';
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

export default function BlogPost() {
  const { t } = useTranslation();
  const { pubkey, dTag } = useParams<{ pubkey: string; dTag: string }>();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  
  const { data: post, isLoading, error } = useBlogPost(pubkey!, dTag!);
  const deleteMutation = useDeleteBlogPost();
  
  const isAuthorized = useIsAuthorizedAuthor(user?.pubkey);
  const isAuthor = post && user && post.pubkey === user.pubkey;
  
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Redirect if missing params
  if (!pubkey || !dTag) {
    return <Navigate to="/blog" replace />;
  }

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!post) return;

    try {
      await deleteMutation.mutateAsync({
        eventId: post.id,
        reason: 'Blog post deleted by author',
      });
      
      toast({
        title: t('blog.delete.success.title'),
        description: t('blog.delete.success.description'),
      });
      
      navigate('/blog');
    } catch (error) {
      const errorObj = error as { message?: string };
      toast({
        title: t('blog.delete.error.title'),
        description: errorObj.message || t('blog.delete.error.description'),
        variant: 'destructive',
      });
    } finally {
      setShowDeleteDialog(false);
    }
  };

  const handleEditorSave = () => {
    setIsEditing(false);
  };

  const handleEditorCancel = () => {
    setIsEditing(false);
  };

  const heroTitle = post?.title || t('blog.post.loading.title');
  const heroDescription = isLoading ? t('blog.post.loading.description') : undefined;

  return (
    <>
      <DesktopHeader />

      <PageHero
        icon={BookOpen}
        title={heroTitle}
        description={heroDescription}
      >
        <div className="container mx-auto px-4 max-w-2xl pb-12">
          {isLoading ? (
            <PageLoading 
              title={t('blog.post.loading.title')}
              description={t('blog.post.loading.description')}
              className="[&_p]:text-white/80 adventure:[&_p]:text-stone-600"
            />
          ) : error || !post ? (
            <div className="rounded-xl border bg-card p-8 text-center">
              <h3 className="text-lg font-semibold mb-2">{t('blog.post.notFound.title')}</h3>
              <p className="text-muted-foreground">
                {t('blog.post.notFound.description')}
              </p>
            </div>
          ) : isEditing ? (
            <BlogPostEditor
              post={post}
              onSave={handleEditorSave}
              onCancel={handleEditorCancel}
            />
          ) : (
            <BlogPostDetail
              post={post}
              showAuthorActions={Boolean(isAuthorized && isAuthor)}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('blog.delete.confirm.title')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('blog.delete.confirm.description', { title: post?.title })}
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
      </PageHero>
    </>
  );
}
