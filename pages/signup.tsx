import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { isGoogleSsoEnabled } from '~/lib/auth';
import { env } from '~/config/env';

export const getServerSideProps: GetServerSideProps<{
  ssoEnabled: boolean
  allowedDomain: string
}> = async () => ({
  props: {
    ssoEnabled: isGoogleSsoEnabled,
    allowedDomain: env.AUTH_ALLOWED_EMAIL_DOMAIN ?? '',
  },
});

export default function SignupPage(
  { ssoEnabled, allowedDomain }: InferGetServerSidePropsType<typeof getServerSideProps>,
) {
  const ssoAvailable = ssoEnabled && allowedDomain;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-black">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">
            {ssoAvailable ? 'Accede con Google' : 'Registros Deshabilitados'}
          </CardTitle>
          <CardDescription>
            {ssoAvailable
              ? `Si tienes una cuenta @${allowedDomain}, inicia sesión con Google y tu cuenta se creará automáticamente.`
              : 'El registro de nuevas cuentas no está disponible en este momento. Esta aplicación es de uso interno.'}
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
