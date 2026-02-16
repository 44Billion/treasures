import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';
import { CreateBlogPostData, UpdateBlogPostData, BlogPost } from '@/types/blog';
import { useCreateBlogPost, useUpdateBlogPost } from '../hooks/useBlogPublish';
import { validateBlogPostData, generateDTag } from '../utils/blogUtils';
import { X, Plus, Save, Eye } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface BlogPostEditorProps {
  post?: BlogPost; // If provided, we're editing; otherwise creating
  onSave?: (post: BlogPost) => void;
  onCancel?: () => void;
}

export function BlogPostEditor({ post, onSave, onCancel }: BlogPostEditorProps) {
  const { toast } = useToast();
  const createMutation = useCreateBlogPost();
  const updateMutation = useUpdateBlogPost();
  
  const [formData, setFormData] = useState<CreateBlogPostData>({
    title: post?.title || '',
    content: post?.content || '',
    summary: post?.summary || '',
    image: post?.image || '',
    tags: post?.tags.filter(tag => tag !== 'treasures') || [], // Exclude the treasures tag from editing
    dTag: post?.dTag || '',
  });

  const [newTag, setNewTag] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const isEditing = !!post;
  const isLoading = createMutation.isPending || updateMutation.isPending;

  // Update dTag when title changes (only for new posts)
  useEffect(() => {
    if (!isEditing && formData.title && !formData.dTag) {
      setFormData(prev => ({
        ...prev,
        dTag: generateDTag(formData.title),
      }));
    }
  }, [formData.title, isEditing, formData.dTag]);

  const handleInputChange = (field: keyof CreateBlogPostData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear errors when user starts typing
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags?.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), newTag.trim()],
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToRemove) || [],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate the form
    const validationErrors = validateBlogPostData(formData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      if (isEditing) {
        const updateData: UpdateBlogPostData = {
          ...formData,
          dTag: post.dTag, // Keep the original dTag for updates
        };
        await updateMutation.mutateAsync(updateData);
        toast({
          title: 'Success',
          description: 'Blog post updated successfully!',
        });
      } else {
        await createMutation.mutateAsync(formData);
        toast({
          title: 'Success',
          description: 'Blog post published successfully!',
        });
      }
      
      onSave?.(post!); // TypeScript: we know post exists after successful mutation
    } catch (error) {
      const errorObj = error as { message?: string };
      toast({
        title: 'Error',
        description: errorObj.message || 'Failed to save blog post',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {isEditing ? 'Edit Blog Post' : 'Create New Blog Post'}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
                className="gap-2"
              >
                <Eye className="w-4 h-4" />
                {showPreview ? 'Edit' : 'Preview'}
              </Button>
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {errors.length > 0 && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <h4 className="font-medium text-destructive mb-2">Please fix the following errors:</h4>
              <ul className="list-disc list-inside text-sm text-destructive">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {showPreview ? (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold mb-2">{formData.title || 'Untitled'}</h1>
                {formData.summary && (
                  <p className="text-lg text-muted-foreground italic">{formData.summary}</p>
                )}
              </div>

              {formData.image && (
                <div className="aspect-video w-full overflow-hidden rounded-lg">
                  <img 
                    src={formData.image} 
                    alt={formData.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="prose prose-gray dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {formData.content || '*No content yet...*'}
                </ReactMarkdown>
              </div>

              {formData.tags && formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">#treasures</Badge>
                  {formData.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">#{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Enter blog post title..."
                  className="mt-1"
                />
              </div>

              {/* Summary */}
              <div>
                <Label htmlFor="summary">Summary</Label>
                <Textarea
                  id="summary"
                  value={formData.summary}
                  onChange={(e) => handleInputChange('summary', e.target.value)}
                  placeholder="Brief summary of the post (optional)..."
                  rows={2}
                  className="mt-1"
                />
              </div>

              {/* Image URL */}
              <div>
                <Label htmlFor="image">Header Image URL</Label>
                <Input
                  id="image"
                  type="url"
                  value={formData.image}
                  onChange={(e) => handleInputChange('image', e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="mt-1"
                />
              </div>

              {/* Tags */}
              <div>
                <Label>Tags</Label>
                <div className="mt-1 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Add a tag..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                    />
                    <Button type="button" onClick={handleAddTag} size="sm">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">#treasures (auto-added)</Badge>
                    {formData.tags?.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        #{tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div>
                <Label htmlFor="content">Content * (Markdown supported)</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => handleInputChange('content', e.target.value)}
                  placeholder="Write your blog post content in Markdown..."
                  rows={15}
                  className="mt-1 font-mono"
                />
              </div>

              {/* URL Identifier (for editing) */}
              {isEditing && (
                <div>
                  <Label htmlFor="dTag">URL Identifier</Label>
                  <Input
                    id="dTag"
                    value={formData.dTag}
                    disabled
                    className="mt-1 bg-muted"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    URL identifier cannot be changed when editing
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-end">
                <Button type="submit" disabled={isLoading} className="gap-2">
                  <Save className="w-4 h-4" />
                  {isLoading ? 'Saving...' : isEditing ? 'Update Post' : 'Publish Post'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}