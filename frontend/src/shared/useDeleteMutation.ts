import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dataProvider } from '../dataProvider';

export interface DeleteTarget {
  ids: (string | number)[];
  label: string;
}

export const useDeleteMutation = (resource: string, onAfterDelete?: (ids: (string | number)[]) => void) => {
  const qc = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const mutation = useMutation({
    mutationFn: (ids: (string | number)[]) =>
      Promise.all(ids.map((id) => dataProvider.delete(resource, id))),
    onSuccess: (_data, ids) => {
      qc.invalidateQueries({ queryKey: [resource] });
      setDeleteTarget(null);
      if (onAfterDelete) onAfterDelete(ids);
    },
    // Yetki/kilit hatalari sessizce yutulmamali — create/edit ile ayni toast kanali.
    // (Ornek: 403 "Required permissions are not granted: X.Delete")
    onError: (err: Error) => {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', message: err.message } }));
      setDeleteTarget(null);
    },
  });

  const confirmDelete = () => {
    if (deleteTarget) mutation.mutate(deleteTarget.ids);
  };

  const requestDelete = (ids: (string | number)[], label: string) => {
    setDeleteTarget({ ids, label });
  };

  const requestSingleDelete = (id: string | number) => {
    setDeleteTarget({ ids: [id], label: String(id) });
  };

  return {
    deleteTarget, setDeleteTarget,
    confirmDelete, requestDelete, requestSingleDelete,
    isPending: mutation.isPending,
  };
};
