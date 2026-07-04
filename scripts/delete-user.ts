/**
 * Elimina la cuenta de un usuario (offboarding): borra sus sesiones activas,
 * sus credenciales y el usuario mismo. Los datos del radar (proyectos, notas)
 * no se tocan — son del equipo, no de la persona.
 *
 *   bun run scripts/delete-user.ts colega@email.com
 *
 * Requiere la base de datos corriendo (docker compose up).
 */
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { user, session, account } from '../db/schema';

const [email] = process.argv.slice(2);

if (!email) {
  console.error('Uso: bun run scripts/delete-user.ts <email>');
  process.exit(1);
}

const [target] = await db.select().from(user).where(eq(user.email, email)).limit(1);

if (!target) {
  console.error(`❌ No existe ningún usuario con el email ${email}`);
  process.exit(1);
}

await db.delete(session).where(eq(session.userId, target.id));
await db.delete(account).where(eq(account.userId, target.id));
await db.delete(user).where(eq(user.id, target.id));

console.log(`✅ Usuario eliminado: ${email} (sesiones cerradas y acceso revocado)`);
process.exit(0);
