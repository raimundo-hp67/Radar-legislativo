import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { LoginForm } from '~/components/auth/login-form';
import { isGoogleSsoEnabled } from '~/lib/auth';

export const getServerSideProps: GetServerSideProps<{ ssoEnabled: boolean }> = async () => ({
  props: {
    ssoEnabled: isGoogleSsoEnabled,
  },
});

export default function LoginPage(
  { ssoEnabled }: InferGetServerSidePropsType<typeof getServerSideProps>,
) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="flex flex-col items-center gap-4">
        <LoginForm ssoEnabled={ssoEnabled} />
      </div>
    </div>
  );
}
