/**
 * Seed script for initial legal projects
 * Run with: bun run scripts/seed-legal-projects.ts
 */

import { db } from '../db';
import { legalProjects, user } from '../db/schema';
import { and, asc, eq } from 'drizzle-orm';

const initialProjects = [
  {
    boletin: '13828-19',
    title: 'Protección Neuroderechos e Integridad Mental',
    relevance: 'LOW' as const,
    dateIngreso: '2020-10-07',
    notes: 'Estado tramitación: segundo trámite',
  },
  {
    boletin: '14838-03',
    title: 'Regulación Plataformas de Apuestas en Línea',
    relevance: 'MEDIUM' as const,
    dateIngreso: '2022-03-07',
    notes: 'Estado tramitación: segundo trámite',
  },
  {
    boletin: '15975-25',
    title: 'Inteligencia Económica',
    relevance: 'HIGH' as const,
    dateIngreso: '2023-05-31',
    notes: 'Estado tramitación: segundo trámite',
  },
  {
    boletin: '16271-03',
    title: 'Fortalecimiento de SERNAC "SERNAC TE PROTEGE"',
    relevance: 'HIGH' as const,
    dateIngreso: '2023-09-07',
    notes: 'Estado tramitación: primer trámite',
  },
  {
    boletin: '16799-05',
    title: 'Crear agencia de calidad de políticas públicas',
    relevance: 'LOW' as const,
    dateIngreso: '2024-04-24',
    notes: 'Estado tramitación: segundo trámite',
  },
  {
    boletin: '16821-19',
    title: 'Regulación de los sistemas de Inteligencia Artificial',
    relevance: 'HIGH' as const,
    dateIngreso: '2024-05-07',
    notes: 'Estado tramitación: segundo trámite',
  },
  {
    boletin: '16889-05',
    title: 'Agencia de Financiamiento e Inversión para el Desarrollo (Afide)',
    relevance: 'MEDIUM' as const,
    dateIngreso: '2024-05-31',
    notes: 'Estado tramitación: segundo trámite',
  },
  {
    boletin: '17112-19',
    title: 'Límites al desarrollo de la IA, en resguardo de DDHH',
    relevance: 'LOW' as const,
    dateIngreso: '2024-09-03',
    notes: 'Estado tramitación: primer trámite',
  },
  {
    boletin: '17590-05',
    title: 'Creación de Sistema Nacional de Gestión de Datos, y modifica los cuerpos legales',
    relevance: 'HIGH' as const,
    dateIngreso: '2025-06-10',
    notes: 'Estado tramitación: primer trámite',
  },
  {
    boletin: '17618-19',
    title: 'Obligación de establecer un sello claro y rastreable del contenido generado con inteligencia artificial',
    relevance: 'MEDIUM' as const,
    dateIngreso: '2025-06-17',
    notes: 'Estado tramitación: primer trámite',
  },
  {
    boletin: '17725-05',
    title: 'Beneficios tributarios a la clase media, compensados mediante la tributación que indica, reduce exenciones y modifica otras disposiciones',
    relevance: 'LOW' as const,
    dateIngreso: '2025-08-08',
    notes: 'Estado tramitación: primer trámite',
  },
];

async function seed() {
  console.log('🌱 Starting seed...\n');

  // Cada proyecto pertenece a un usuario. Los de ejemplo se asignan al primer
  // usuario (admin). Si aún no existe ninguno, se omite sin fallar.
  const [firstUser] = await db.select({ id: user.id }).from(user).orderBy(asc(user.createdAt)).limit(1);
  if (!firstUser) {
    console.log('⏭️  Aún no hay usuarios. Crea tu cuenta primero (regístrate en el navegador) y vuelve a correr este seed si quieres los proyectos de ejemplo.');
    process.exit(0);
  }

  let created = 0;
  let skipped = 0;

  for (const project of initialProjects) {
    // ¿Este usuario ya sigue este boletín?
    const [existing] = await db
      .select()
      .from(legalProjects)
      .where(and(eq(legalProjects.boletin, project.boletin), eq(legalProjects.userId, firstUser.id)))
      .limit(1);

    if (existing) {
      console.log(`⏭️  Skipping ${project.boletin} - already exists`);
      skipped++;
      continue;
    }

    // Insert new project
    await db.insert(legalProjects).values({ ...project, userId: firstUser.id });
    console.log(`✅ Created ${project.boletin} - ${project.title}`);
    created++;
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total: ${initialProjects.length}`);

  console.log('\n✨ Seed completed!');
  process.exit(0);
}

seed().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
