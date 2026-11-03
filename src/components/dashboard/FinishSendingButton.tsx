'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useLang } from '@/components/LangProvider';
import { Button } from '@/components/ui/Button';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { platformCopy } from '@/lib/copy/platform';
import { responseErrorText } from '@/lib/errorText';

interface FinishSendingButtonProps {
  slug: string;
  notificationId: string;
}

/** Sends a Notification to the devices it has not reached, then shows the page's log as it now stands. */
export function FinishSendingButton({ slug, notificationId }: FinishSendingButtonProps) {
  const pageLang = useLang();
  const t = platformCopy[pageLang].notifications;
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function finish() {
    setSending(true);
    setFailure(null);
    const res = await fetch(`/api/sites/${slug}/notifications/${notificationId}`, { method: 'POST' }).catch(() => null);
    if (res?.ok) {
      router.refresh();
    } else {
      setFailure(responseErrorText(await res?.json().catch(() => null), pageLang));
    }
    setSending(false);
  }

  return (
    <>
      <div>
        <Button loading={sending} onClick={finish}>
          {sending ? t.finishing : t.finish}
        </Button>
      </div>
      <StatusMessage tone="danger">{failure}</StatusMessage>
    </>
  );
}
