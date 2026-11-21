'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useLang } from '@/components/LangProvider';
import { Button } from '@/components/ui/Button';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { platformCopy } from '@/lib/copy/platform';
import { responseErrorText } from '@/lib/errorText';
import { platformApi, refusalOf } from '@/lib/platformApi';

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
    try {
      await platformApi.post(`sites/${slug}/notifications/${notificationId}`);
      router.refresh();
    } catch (error) {
      setFailure(responseErrorText(refusalOf(error), pageLang));
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
