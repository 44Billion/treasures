import { useParams, Navigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { FullPageLoading } from '@/components/ui/loading';
import { Card, CardContent } from '@/components/ui/card';
import { BlogPostDetail } from '@/features/blog/components/BlogPostDetail';
import { BlogPostEditor } from '@/features/blog/components/BlogPostEditor';
import { useBlogPost, useIsAuthorizedAuthor } from '@/features/blog/hooks/useBlogPosts';
import { useDeleteBlogPost } from '@/features/blog/hooks/useBlogPublish';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useState } from 'react';
import { useToast } from '@/shared/hooks/useToast';
import { useNavigate } from 'react-router-dom';
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
        title: 'Success',
        description: 'Blog post deleted successfully',
      });
      
      navigate('/blog');
    } catch (error) {
      const errorObj = error as { message?: string };
      toast({
        title: 'Error',
        description: errorObj.message || 'Failed to delete blog post',
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

  if (isLoading) {
    return (
      <PageLayout>
        <div className="container mx-auto px-4 py-8">
          <FullPageLoading 
            title="Loading blog post..."
            description="Fetching the latest content"
          />
        </div>
      </PageLayout>
    );
  }

  if (error || !post) {
    return (
      <PageLayout>
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-8 text-center">
              <h3 className="text-lg font-semibold mb-2">Blog post not found</h3>
              <p className="text-muted-foreground">
                The blog post you're looking for doesn't exist or has been removed.
              </p>
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout maxWidth='2xl'>
      <div className="container mx-auto px-4 py-8">
        {isEditing ? (
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
              <AlertDialogTitle>Delete Blog Post</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{post.title}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PageLayout>
  );
}