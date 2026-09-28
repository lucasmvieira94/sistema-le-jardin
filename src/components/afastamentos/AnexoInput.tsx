import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TIPOS_ANEXO, validarAnexo } from '@/utils/anexoAfastamento';

export default function AnexoInput({ onChange, value, disabled }: { onChange: (file: File | null) => void; value: File | null; disabled?: boolean }) {
  const [error, setError] = useState('');
  return <div className="space-y-1">
    <Label htmlFor="anexo-afastamento">Documento do afastamento (opcional)</Label>
    <Input id="anexo-afastamento" type="file" accept={TIPOS_ANEXO} disabled={disabled} onChange={event => {
      const file = event.target.files?.[0] ?? null;
      try { if (file) validarAnexo(file); onChange(file); setError(''); }
      catch (cause) { onChange(null); setError(cause instanceof Error ? cause.message : 'Arquivo inválido'); event.target.value = ''; }
    }} />
    {value && <p className="text-xs text-muted-foreground truncate">{value.name}</p>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    <p className="text-xs text-muted-foreground">PDF, imagens, DOCX, ODT, TXT ou RTF. Até 20 MB. Tudo é convertido para PDF e autenticado.</p>
  </div>;
}