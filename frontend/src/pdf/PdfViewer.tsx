import React, { useEffect } from 'react';
import { usePdfGenerate } from './usePdfGenerate';

interface PdfViewerProps {
  templatePath: string;
  params?: Record<string, string>;
  autoLoad?: boolean;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ templatePath, params, autoLoad = true }) => {
  const { blobUrl, loading, generate } = usePdfGenerate();
  const [template, setTemplate] = React.useState<any>(null);

  useEffect(() => {
    fetch(templatePath)
      .then(r => r.json())
      .then(t => {
        setTemplate(t);
        if (autoLoad) generate(t, params);
      })
      .catch(() => {});
  }, [templatePath]); // eslint-disable-line

  if (loading) return <div style={{ padding: 16, textAlign: 'center' }}>Generating PDF...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {blobUrl && (
        <iframe
          src={blobUrl}
          style={{ width: '100%', height: 600, border: '1px solid #ddd', borderRadius: 4 }}
          title="PDF"
        />
      )}
      {template && (
        <button
          onClick={() => generate(template, params)}
          style={{ padding: '6px 16px', border: '1px solid #1976d2', borderRadius: 4, background: '#1976d2', color: '#fff', cursor: 'pointer', alignSelf: 'flex-start' }}
        >
          {blobUrl ? 'Refresh' : 'Generate'} PDF
        </button>
      )}
    </div>
  );
};

export default PdfViewer;
