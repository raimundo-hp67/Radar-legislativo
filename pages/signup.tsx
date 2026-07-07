import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { SignupForm } from '~/components/auth/signup-form';
import { isGoogleSsoEnabled, hasAnyUser } from '~/lib/auth';
import { env } from '~/config/env';

export const getServerSideProps: GetServerSideProps<{
  ssoEnabled: boolean
  allowedDomain: string
  canBootstrap: boolean
}> = async () => {
  const allowedDomain = env.AUTH_ALLOWED_EMAIL_DOMAIN ?? '';

  // A domain restriction means only SSO-verified emails of that domain may
  // ever create an account (see lib/auth.ts) — the open bootstrap form must
  // never show in that case, even before SSO credentials are configured.
  // Fail closed on a DB error: default to "no bootstrap" rather than a 500.
  let canBootstrap = false;
  if (!allowedDomain) {
    try {
      canBootstrap = !(await hasAnyUser());
    } catch (error) {
      console.error('signup: failed to check existing users', error);
    }
  }

  return {
    props: {
      ssoEnabled: isGoogleSsoEnabled,
      allowedDomain,
      canBootstrap,
    },
  };
};

export default function SignupPage(
  { ssoEnabled, allowedDomain, canBootstrap }: InferGetServerSidePropsType<typeof getServerSideProps>,
) {
  const ssoAvailable = ssoEnabled && allowedDomain;

  if (canBootstrap) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-black">
        <div className="flex flex-col items-center gap-4">
          <SignupForm />
        </div>
      </div>
    );
  }

  const title = ssoAvailable
    ? 'Accede con Google'
    : allowedDomain
      ? 'Acceso restringido'
      : 'Este portal ya tiene una cuenta';

  const description = ssoAvailable
    ? `Si tienes una cuenta @${allowedDomain}, inicia sesión con Google y tu cuenta se creará automáticamente.`
    : allowedDomain
      ? `Esta aplicación solo admite cuentas @${allowedDomain} vía Google. Pídele a quien la administra que active el login con Google, o que te cree una cuenta corriendo "bun run scripts/create-user.ts" en su terminal.`
      : 'Esta aplicación es de uso interno y ya tiene un usuario creado: no hay registro abierto. Pídele a quien la administra que te cree una cuenta (corriendo "bun run scripts/create-user.ts" en su terminal) y que te pase el email y la contraseña.';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-black">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Link href="/login">
            <Button variant="outline">Ir a Iniciar Sesión</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
