'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useLang } from '@/components/LangProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageShell } from '@/components/ui/PageShell';
import { Stack } from '@/components/ui/Stack';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { platformCopy } from '@/lib/copy/platform';
import { responseErrorText } from '@/lib/errorText';
import { type NewPasswordValues, newPasswordFormSchema } from '@/lib/passwordRules';
import { platformApi, refusalOf } from '@/lib/platformApi';
import { adoptScreenValues, NewPasswordFields, rememberCredentials } from './NewPasswordFields';

const resolver = zodResolver(newPasswordFormSchema);

/**
 * The change-password page's form: a new password, its confirmation, and on
 * success the Dashboard. `pending` says the login asked for the change.
 */
export function ChangePasswordForm({ email, pending }: { email: string; pending: boolean }) {
  const router = useRouter();
  const lang = useLang();
  const t = platformCopy[lang].auth;
  const copy = t.changePassword;
  const form = useForm<NewPasswordValues>({ defaultValues: { password: '', 'confirm-password': '' }, resolver });
  const { handleSubmit, setError, formState } = form;
  // router.push returns before the next page arrives; its transition stays pending until then.
  const [navigating, startNavigation] = useTransition();
  const busy = formState.isSubmitting || navigating;

  async function send({ password }: NewPasswordValues) {
    try {
      await platformApi.post('auth/password', { json: { password } });
    } catch (error) {
      setError('root.server', { message: responseErrorText(refusalOf(error), lang) });
      return;
    }
    await rememberCredentials(email, password);
    startNavigation(() => {
      router.push('/dashboard');
      router.refresh();
    });
  }

  return (
    <PageShell width="narrow">
      <Card title={copy.title} description={pending ? copy.pendingDescription : copy.description} headingLevel={1}>
        <FormProvider {...form}>
          <form
            onSubmit={(e) => {
              adoptScreenValues(e.currentTarget, form);
              void handleSubmit(send)(e);
            }}
          >
            <Stack gap={5}>
              {/* Tells password managers whose saved password the new one replaces. */}
              <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
              <NewPasswordFields label={t.newPassword} />
              <StatusMessage tone="danger">{formState.errors.root?.server?.message}</StatusMessage>
              <Button variant="primary" type="submit" fullWidth loading={busy}>
                {busy ? copy.submitting : copy.submit}
              </Button>
            </Stack>
          </form>
        </FormProvider>
      </Card>
    </PageShell>
  );
}
