import React from 'react';
import { UiDialog, UiButton } from './ui';

interface DeleteConfirmDialogProps {
  visible: boolean;
  label: string;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  visible, label, isPending, onConfirm, onCancel,
}) => (
  <UiDialog
    visible={visible}
    header={"Silme onayı"}
    onClose={onCancel}
    footer={<>
      <UiButton label={"Vazgeç"} variant="secondary" onClick={onCancel} />
      <UiButton label={isPending ? "Siliniyor…" : "Sil"} variant="danger" onClick={onConfirm} disabled={isPending} />
    </>}
  >
    <strong>{label}</strong> {"silinsin mi? Bu işlem geri alınamaz."}
  </UiDialog>
);
