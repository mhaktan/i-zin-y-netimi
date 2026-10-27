import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@takeoff-ui/react-spar';
import { SparDateField, SparTextField } from '../../shared/ui';
import { dataProvider } from '../../dataProvider';
import { overlayStyle, modalStyle } from '../../styles';
import { LookupSelect } from '../../shared/LookupSelect';
import { useFlows } from '../../flows/FlowProvider';

type LeaveRequestRecord = {
  id: string | number;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string;
  doctorReportNote?: string;
  status: string;
  revisionNote?: string;
  managerId: number;
  userId?: string;
};

const DEFAULTS: Partial<LeaveRequestRecord> = {} as Partial<LeaveRequestRecord>;

interface LeaveRequestCreateProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const LeaveRequestCreate: React.FC<LeaveRequestCreateProps> = ({ open, onClose, onSuccess }) => {
  const [form, setForm] = useState<Partial<LeaveRequestRecord>>(DEFAULTS);
  const setField = (name: string, value: unknown) => setForm((p) => ({ ...p, [name]: value }));
  const { triggerFlows } = useFlows();

  const mutation = useMutation({
    mutationFn: (values: Partial<LeaveRequestRecord>) => dataProvider.create('LeaveRequest', values),
    onSuccess: (_data, values) => { triggerFlows('create', 'LeaveRequest', values as Record<string, unknown>); onSuccess(); onClose(); setForm(DEFAULTS); },
    onError: (err: Error) => { window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', message: err.message } })); },
  });

  if (!open) return null;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '20px 28px 0', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{"Yeni İzin Talebi"}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#666', padding: '4px 8px', borderRadius: 4 }} onMouseOver={(e) => (e.currentTarget.style.color = '#333')} onMouseOut={(e) => (e.currentTarget.style.color = '#666')}>✕</button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: '16px' }}>
                <div style={{ gridColumn: 'span 6' }}>
                  <LookupSelect label="İzin Türü *" value={String(form.leaveType ?? '')} onChange={(v) => setField('leaveType', v ? Number(v) : null)} searchable={false} options={[{ label: "Yıllık", value: "0" }, { label: "Hastalık", value: "1" }, { label: "Doğum", value: "2" }, { label: "Babalık", value: "3" }, { label: "Ücretsiz", value: "4" }, { label: "Diğer", value: "5" }]} />
                </div>
                <div style={{ gridColumn: 'span 6' }}>
                  <SparDateField label="Başlangıç Tarihi *" value={String(form.startDate ?? '')} onChange={(v) => setField('startDate', v)} />
                </div>
                <div style={{ gridColumn: 'span 6' }}>
                  <SparDateField label="Bitiş Tarihi *" value={String(form.endDate ?? '')} onChange={(v) => setField('endDate', v)} />
                </div>
                <div style={{ gridColumn: 'span 6' }}>
                  <SparTextField label="Toplam Gün *" value={String(form.totalDays ?? '')} onChange={(v) => setField('totalDays', v === '' ? null : Number(v))} type="number" />
                </div>
                <div style={{ gridColumn: 'span 6' }}>
                  <SparTextField label="Açıklama" value={String(form.reason ?? '')} onChange={(v) => setField('reason', v)} />
                </div>
                <div style={{ gridColumn: 'span 6' }}>
                  <SparTextField label="Doktor Raporu Bilgisi" value={String(form.doctorReportNote ?? '')} onChange={(v) => setField('doctorReportNote', v)} />
                </div>
                <div style={{ gridColumn: 'span 6' }}>
                  <SparTextField label="Yönetici *" value={String(form.managerId ?? '')} onChange={(v) => setField('managerId', v === '' ? null : Number(v))} type="number" />
                </div>
                <div style={{ gridColumn: 'span 6' }}>
                  <LookupSelect label="Kullanıcı (Sistem)" resource="User" value={String(form.userId ?? '')} onChange={(v) => setField('userId', v)} displayField="name" />
                </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 28px', borderTop: '1px solid #e8e8e8', flexShrink: 0, background: '#fff' }}>
            <Button variant="primary" appearance="outlined" onClick={onClose}>{"Vazgeç"}</Button>
            <Button variant="primary" appearance="filled" type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Kaydediliyor…" : "Kaydet"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
};
