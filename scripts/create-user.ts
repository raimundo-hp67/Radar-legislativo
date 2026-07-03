/**
 * Provision a user from the command line (e.g. the first admin account).
 *
 * Self-signup is disabled in the app, so this is the supported way to create
 * accounts when Google SSO is not configured:
 *
 *   bun run scripts/create-user.ts admin@example.com 'una-clave-segura' 'Nombre'
 *
 * Requires the database to be running (docker compose up).
 */

// Must be set BEFORE importing ~/lib/auth: it lifts the signup restriction
// for this process only. Never set this on a deployed server.
process.env.AUTH_PROVISION = '1';

const [email, password, displayName] = process.argv.slice(2);

if (!email || !password) {
  console.error('Uso: bun run scripts/create-user.ts <email> <password> [nombre]');
  process.exit(1);
}

if (password.length < 8) {
  console.error('La contraseña debe tener al menos 8 caracteres.');
  process.exit(1);
}

const { auth } = await import('../lib/auth');

try {
  const result = await auth.api.signUpEmail({
    body: {
      email,
      password,
      name: displayName ?? email.split('@')[0],
    },
  });
  console.log(`✅ Usuario creado: ${result.user.email} (${result.user.name})`);
  process.exit(0);
} catch (error) {
  console.error('❌ No se pudo crear el usuario:', error instanceof Error ? error.message : error);
  process.exit(1);
}

export {};
