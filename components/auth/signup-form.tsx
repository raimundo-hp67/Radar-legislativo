import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { signUp } from '~/lib/auth-client';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';

/**
 * Formulario de creación de cuenta. Con registro abierto (AUTH_OPEN_SIGNUP=1,
 * el default del instalador) cualquiera crea la suya y ve solo sus propios
 * datos; con registro cerrado solo funciona para la primera cuenta de una
 * instalación nueva (bootstrap) — ver lib/auth.ts.
 */
export function SignupForm({ openSignup = false }: { openSignup?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setLoading(true);
    const { error } = await signUp.email({ name, email, password });

    if (error) {
      setError(error.message || 'No se pudo crear la cuenta');
      setLoading(false);
    } else {
      router.push('/legal');
    }
  };

  return (
    <Card className="w-full min-w-[400px] border-0 shadow-none sm:border sm:shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Crea tu cuenta</CardTitle>
        <CardDescription>
          {openSignup
            ? 'Tu espacio es privado: solo tú ves tus proyectos y notas.'
            : 'Solo funciona la primera vez: crea la cuenta principal de este portal.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="warning">
            <TriangleAlert className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              type="text"
              placeholder="Tu nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?
          {' '}
          <Link href="/login" className="font-medium text-primary underline underline-offset-4">
            Iniciar sesión
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
