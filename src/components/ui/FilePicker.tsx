'use client';

import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/components/LangProvider';
import { uiCopy } from '@/lib/copy/ui';
import { Field, useFieldControlProps } from './Field';
import styles from './FilePicker.module.css';
import { Icon } from './Icon';

export type PickedFile = File | { url: string; name: string; type?: string; size?: number };

interface FilePickerProps {
  label: string;
  hint?: string;
  optional?: boolean;
  accept: readonly string[];
  maxBytes: number;
  value: PickedFile | null;
  onChange: (file: File) => void;
}

/** A single file selected by browsing or dropping, validated before it reaches the form. */
export function FilePicker(props: FilePickerProps) {
  const [error, setError] = useState('');
  useEffect(() => {
    if (!props.value) {
      setError('');
    }
  }, [props.value]);
  return (
    <Field label={props.label} hint={props.hint} optional={props.optional} error={error} liveHint>
      <PickerControl {...props} error={error} onError={setError} />
    </Field>
  );
}

function PickerControl({
  label,
  accept,
  maxBytes,
  value,
  onChange,
  error,
  onError,
}: FilePickerProps & { error: string; onError: (message: string) => void }) {
  const lang = useLang();
  const t = uiCopy[lang].filePicker;
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState<'valid' | 'invalid' | null>(null);
  const field = useFieldControlProps({});
  const state = pickerState(error, dragging, value);
  function choose(files: File[]) {
    setDragging(null);
    if (files.length !== 1) {
      onError(t.single);
      return;
    }
    const file = files[0];
    if (!accept.includes(file.type)) {
      onError(t.type);
      return;
    }
    if (file.size === 0 || file.size > maxBytes) {
      onError(`${t.size} ${formatFileSize(maxBytes, lang)}.`);
      return;
    }
    onError('');
    onChange(file);
  }
  return (
    <>
      <input
        ref={input}
        hidden
        type="file"
        accept={accept.join(',')}
        aria-label={`${label} file`}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) {
            choose(files);
          }
          event.target.value = '';
        }}
      />
      <button
        {...field}
        type="button"
        className={styles.area}
        data-state={state}
        onClick={() => input.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(dragValidity(event.dataTransfer, accept));
        }}
        onDragOver={(event) => {
          event.preventDefault();
          const validity = dragValidity(event.dataTransfer, accept);
          setDragging(validity);
          event.dataTransfer.dropEffect = validity === 'valid' ? 'copy' : 'none';
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            setDragging(null);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          choose(Array.from(event.dataTransfer.files));
        }}
      >
        <span className={styles.symbol}>
          <Icon name="plus" />
        </span>
        <span className={styles.prompt}>{dragPrompt(dragging, t)}</span>
        <span className={styles.hint}>{t.orDrop}</span>
      </button>
      <div className={styles.selection} role="status">
        {value ? <FileSummary value={value} /> : null}
      </div>
    </>
  );
}

function pickerState(error: string, dragging: 'valid' | 'invalid' | null, value: PickedFile | null) {
  if (dragging) {
    return dragging === 'valid' ? 'drag-valid' : 'drag-invalid';
  }
  if (error) {
    return 'error';
  }
  return value ? 'selected' : 'empty';
}

export function formatFileSize(bytes: number, lang: string): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(mb)} MB`;
  }
  return `${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`;
}

function FileSummary({ value }: { value: PickedFile }) {
  const lang = useLang();
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!(value instanceof File)) {
      setUrl(value.url);
      return;
    }
    const local = URL.createObjectURL(value);
    setUrl(local);
    return () => URL.revokeObjectURL(local);
  }, [value]);
  const type = value.type ?? '';
  return (
    <div className={styles.file}>
      <FileThumbnail key={url} url={url} type={type} />
      <span className={styles.details}>
        <span className={styles.name}>{value.name}</span>
        <span className={styles.metadata}>
          {[type, typeof value.size === 'number' ? formatFileSize(value.size, lang) : null].filter(Boolean).join(' · ')}
        </span>
      </span>
    </div>
  );
}

function FileThumbnail({ url, type }: { url?: string; type: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return null;
  }
  if (type.startsWith('image')) {
    // biome-ignore lint/performance/noImgElement: Local selections use browser object URLs.
    return <img className={styles.thumbnail} src={url} alt="" onError={() => setFailed(true)} />;
  }
  if (!type.startsWith('video')) {
    return null;
  }
  // A short seek decodes a still frame without playing the video or its audio.
  return (
    <video
      key={url}
      className={styles.thumbnail}
      src={url}
      muted
      playsInline
      preload="metadata"
      onLoadedMetadata={(event) => {
        const video = event.currentTarget;
        if (Number.isFinite(video.duration) && video.duration > 0) {
          video.currentTime = Math.min(1, video.duration / 2);
        }
      }}
      onError={() => setFailed(true)}
    />
  );
}

function dragValidity(data: DataTransfer, accept: readonly string[]): 'valid' | 'invalid' {
  const items = Array.from(data.items);
  return items.length === 1 && items[0].kind === 'file' && accept.includes(items[0].type) ? 'valid' : 'invalid';
}

function dragPrompt(dragging: 'valid' | 'invalid' | null, copy: { type: string; drop: string; choose: string }) {
  if (dragging === 'invalid') {
    return copy.type;
  }
  return dragging === 'valid' ? copy.drop : copy.choose;
}
