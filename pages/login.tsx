import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import Link from 'next/link';
import { LoginForm } from '~/components/auth/login-form';
import { isGoogleSsoEnabled, isOpenSignupEnabled, hasAnyUser } from '~/lib/auth';
import { env } from '~/config/env';

export const getServerSideProps: GetServerSideProps<{
  ssoEnabled: boolean
  canSignup: boolean
}> = async () => {
  // Mismo criterio que /signup: mostrar el enlace "crear cuenta" cuando el
  // registro abierto está activo, o cuando aún no existe ninguna cuenta.
  let canSignup = isOpenSignupEnabled;
  if (!canSignup && !env.AUTH_ALLOWED_EMAIL_DOMAIN) {
    try {
      canSignup = !(await hasAnyUser());
    } catch (error) {
      console.error('login: failed to check existing users', error);
    }
  }

  return {
    props: {
      ssoEnabled: isGoogleSsoEnabled,
      canSignup,
    },
  };
};

export default function LoginPage(
  { ssoEnabled, canSignup }: InferGetServerSidePropsType<typeof getServerSideProps>,
) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-black">
      <div className="flex flex-col items-center gap-4">
        <LoginForm ssoEnabled={ssoEnabled} />
        {canSignup && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ¿No tienes cuenta?
            {' '}
            <Link href="/signup" className="font-medium text-cyan-600 underline-offset-2 hover:underline dark:text-cyan-400">
              Crea la tuya aquí
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
