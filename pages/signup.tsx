import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { SignupForm } from '~/components/auth/signup-form';
import { isGoogleSsoEnabled, isOpenSignupEnabled, hasAnyUser } from '~/lib/auth';
import { env } from '~/config/env';

export const getServerSideProps: GetServerSideProps<{
  ssoEnabled: boolean
  allowedDomain: string
  showSignup: boolean
  openSignup: boolean
}> = async () => {
  const allowedDomain = env.AUTH_ALLOWED_EMAIL_DOMAIN ?? '';

  // Show the email/password signup form when:
  //  - open community signup is on (anyone may register), OR
  //  - no domain restriction AND no account exists yet (bootstrap first user).
  // A domain restriction means only SSO-verified emails may ever register, so
  // the form never shows there. Fail closed on a DB error (no form vs a 500).
  let showSignup = isOpenSignupEnabled;
  if (!showSignup && !allowedDomain) {
    try {
      showSignup = !(await hasAnyUser());
    } catch (error) {
      console.error('signup: failed to check existing users', error);
    }
  }

  return {
    props: {
      ssoEnabled: isGoogleSsoEnabled,
      allowedDomain,
      showSignup,
      openSignup: isOpenSignupEnabled,
    },
  };
};

export default function SignupPage(
  { ssoEnabled, allowedDomain, showSignup, openSignup }: InferGetServerSidePropsType<typeof getServerSideProps>,
) {
  const ssoAvailable = ssoEnabled && allowedDomain;

  if (showSignup) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-black">
        <div className="flex flex-col items-center gap-4">
          <SignupForm openSignup={openSignup} />
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
      : 'El registro está cerrado en esta instalación y ya existe una cuenta. Quien la administra puede crearte una (corriendo "bun run scripts/create-user.ts" en su terminal) o reabrir el registro poniendo AUTH_OPEN_SIGNUP=1 en el archivo .env y reiniciando la app.';

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
