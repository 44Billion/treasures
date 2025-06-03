import { Button } from "@/components/ui/button";
import { useDeleteWithConfirmation } from "@/hooks/useDeleteWithConfirmation";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";

// Test component to verify deletion functionality
export function TestDeleteButton() {
  const {
    confirmSingleDeletion,
    isConfirmDialogOpen,
    isDeletingAny,
    executeDeletion,
    cancelDeletion,
    getConfirmationTitle,
    getConfirmationMessage,
  } = useDeleteWithConfirmation();

  const handleTestDelete = () => {
    confirmSingleDeletion(
      {
        id: "test-cache-id",
        name: "Test Cache",
      },
      "Test deletion",
      () => console.log("Test deletion completed")
    );
  };

  return (
    <>
      <Button onClick={handleTestDelete} disabled={isDeletingAny}>
        Test Delete
      </Button>
      
      <DeleteConfirmationDialog
        isOpen={isConfirmDialogOpen}
        onOpenChange={() => {}}
        title={getConfirmationTitle()}
        description={getConfirmationMessage()}
        isDeleting={isDeletingAny}
        onConfirm={executeDeletion}
        onCancel={cancelDeletion}
      />
    </>
  );
}