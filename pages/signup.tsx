import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { SignupForm } from '~/components/auth/signup-form';
import { isGoogleSsoEnabled } from '~/lib/auth';
import { env } from '~/config/env';
import { db } from '~/db';
import { user } from '~/db/schema';

export const getServerSideProps: GetServerSideProps<{
  ssoEnabled: boolean
  allowedDomain: string
  canBootstrap: boolean
}> = async () => {
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(user);

  return {
    props: {
      ssoEnabled: isGoogleSsoEnabled,
      allowedDomain: env.AUTH_ALLOWED_EMAIL_DOMAIN ?? '',
      canBootstrap: Number(count) === 0,
    },
  };
};

export default function SignupPage(
  { ssoEnabled, allowedDomain, canBootstrap }: InferGetServerSidePropsType<typeof getServerSideProps>,
) {
  const ssoAvailable = ssoEnabled && allowedDomain;

  if (!ssoAvailable && canBootstrap) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-black">
        <div className="flex flex-col items-center gap-4">
          <SignupForm />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-black">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">
            {ssoAvailable ? 'Accede con Google' : 'Este portal ya tiene una cuenta'}
          </CardTitle>
          <CardDescription>
            {ssoAvailable
              ? `Si tienes una cuenta @${allowedDomain}, inicia sesión con Google y tu cuenta se creará automáticamente.`
              : 'Esta aplicación es de uso interno y ya tiene un usuario creado: no hay registro abierto. Pídele a quien la administra que te cree una cuenta (corriendo "bun run scripts/create-user.ts" en su terminal) y que te pase el email y la contraseña.'}
          </CardDescription>
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
