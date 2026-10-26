import { redirect } from 'next/navigation';
import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm';
import { getUserById } from '@/lib/auth';
import { pageSignedIn } from '@/lib/ownerAccessNext';

export default async function ChangePasswordPage() {
  const signedIn = await pageSignedIn();
  const user = await getUserById(signedIn.id);
  if (!user) {
    redirect('/login');
  }
  return <ChangePasswordForm email={user.email} pending={signedIn.passwordChangePending} />;
}
