/**
 * Seed script for fintech/payments/financial-infrastructure bills.
 *
 * Bills identified as missing from the tracker (as of May 2026):
 *
 * - 17286-05  Marco regulatorio pagos electrónicos (nuevo framework competencia pagos)
 * - 18118-07  Bloqueo unificado de tarjetas (notificación única en caso de robo/fraude)
 * - 16408-05  Sobreendeudamiento → promulgado Ley 21.673 (mayo 2024), útil para historial
 * - 15322-05  Resiliencia sistema financiero + acceso cooperativas al BCCh → Ley 21.641
 * - 14847-06  Ley Marco Ciberseguridad → Ley 21.663 (abril 2024), vigente desde ene 2025
 * - 11144-07  Protección de datos personales → Ley 21.719 (dic 2024), vigente dic 2026
 *
 * Already tracked (in seed-legal-projects.ts):
 * - 16821-19  Regulación IA
 * - 17590-05  Sistema Nacional de Gestión de Datos
 *
 * Run with:
 *   bun run scripts/seed-proyectos.ts
 */

import { db } from '../db';
import { legalProjects } from '../db/schema';

const seedProjects = [
  {
    boletin: '17286-05',
    title: 'Marco regulatorio para pagos electrónicos y competencia en medios de pago',
    relevance: 'HIGH' as const,
    dateIngreso: '2024-11-01',
    estado: 'Primer trámite',
    camara: 'Senado',
    urgencia: null,
    comision: 'Comisión de Economía',
    objetivo:
      'Crea un nuevo marco regulatorio para los sistemas de pago electrónico que promueve la competencia, reduce comisiones de tarjetas de crédito y débito, e impone obligaciones de interoperabilidad entre operadores bancarios y no bancarios. Alta relevancia para proveedores de infraestructura de pagos.',
    notes:
      'Aprobado por Comisión de Economía del Senado. Sala analizará idea de legislar. Boletín confirmado en senado.cl',
  },
  {
    boletin: '18118-07',
    title: 'Simplifica bloqueo de tarjetas mediante notificación única en caso de robo, extravío o fraude',
    relevance: 'MEDIUM' as const,
    dateIngreso: '2025-04-01',
    estado: 'Primer trámite',
    camara: 'Senado',
    urgencia: null,
    comision: 'Comisión de Economía',
    objetivo:
      'Modifica Ley 20.009 para que el titular de medios de pago pueda notificar a un único organismo (registro centralizado) el bloqueo de todos sus instrumentos de pago en caso de robo o fraude, en lugar de contactar individualmente a cada emisor. Impacta a emisores de tarjetas y billeteras digitales.',
    notes:
      'Moción de la Senadora Isabel Allende. Ingresado en abril 2025. Primera etapa constitucional.',
  },
  {
    boletin: '14847-06',
    title: 'Ley Marco sobre Ciberseguridad e Infraestructura Crítica de la Información (Ley 21.663)',
    relevance: 'HIGH' as const,
    dateIngreso: '2022-03-01',
    estado: 'Publicada',
    camara: null,
    urgencia: null,
    comision: null,
    objetivo:
      'Establece institucionalidad, principios y normas para la ciberseguridad de organismos del Estado y privados que operan infraestructura crítica. Promulgada en marzo 2024, publicada en el Diario Oficial el 8 de abril 2024, en vigencia desde enero 2025 para operadores de importancia vital. Las empresas de infraestructura financiera quedan en el ámbito de aplicación.',
    notes:
      'Ya es ley (Ley 21.663). Se monitorea para cumplimiento de obligaciones vigentes desde 01/01/2025. Reglamentos en elaboración por ANCI.',
  },
  {
    boletin: '11144-07',
    title: 'Protección y tratamiento de datos personales — Agencia de Protección de Datos (Ley 21.719)',
    relevance: 'HIGH' as const,
    dateIngreso: '2017-03-01',
    estado: 'Publicada',
    camara: null,
    urgencia: null,
    comision: null,
    objetivo:
      'Reforma completa de la Ley 19.628. Crea la Agencia de Protección de Datos Personales y actualiza el régimen de tratamiento de datos. Publicada el 13 de diciembre 2024. Plazo de adecuación de 24 meses (entra en vigor diciembre 2026). Clave para empresas que manejan datos financieros de personas.',
    notes:
      'Ya es ley (Ley 21.719). Vigencia plena: diciembre 2026. Requiere adecuación de contratos, avisos de privacidad y gestión de consentimiento.',
  },
  {
    boletin: '16408-05',
    title: 'Medidas para combatir el sobreendeudamiento y fraude con medios de pago (Ley 21.673)',
    relevance: 'MEDIUM' as const,
    dateIngreso: '2023-11-01',
    estado: 'Publicada',
    camara: null,
    urgencia: null,
    comision: null,
    objetivo:
      'Modifica cuerpos legales para combatir el sobreendeudamiento, transfiere a la CMF la facultad de regular pagos mínimos de tarjetas de crédito y fortalece la Ley de Fraudes. Publicada como Ley 21.673 el 30 de mayo de 2024.',
    notes:
      'Ya es ley (Ley 21.673). Se monitorea para seguimiento de normas CMF sobre tarjetas de crédito derivadas de esta ley.',
  },
  {
    boletin: '15322-05',
    title: 'Resiliencia del sistema financiero y acceso de cooperativas al Banco Central (Ley 21.641)',
    relevance: 'MEDIUM' as const,
    dateIngreso: '2022-09-05',
    estado: 'Publicada',
    camara: null,
    urgencia: null,
    comision: null,
    objetivo:
      'Fortalece la resiliencia del sistema financiero y sus infraestructuras, expande la provisión de liquidez del BCCh a instituciones financieras no bancarias, y da acceso a cooperativas al sistema de pagos del Banco Central. Aprobada en octubre 2023 como Ley 21.641.',
    notes:
      'Ya es ley (Ley 21.641). Relevante para seguimiento de implementación: nuevas instituciones no bancarias con acceso al sistema de pagos del BCCh.',
  },
];

async function seed() {
  console.log('Seeding regulatory projects...\n');

  let created = 0;
  let skipped = 0;

  for (const project of seedProjects) {
    try {
      await db
        .insert(legalProjects)
        .values(project)
        .onConflictDoNothing();

      console.log(`OK  ${project.boletin} — ${project.title.slice(0, 60)}...`);
      created++;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique')) {
        console.log(`SKIP ${project.boletin} — already exists`);
        skipped++;
      } else {
        console.error(`FAIL ${project.boletin}:`, error);
      }
    }
  }

  console.log(`\nDone: ${created} inserted, ${skipped} skipped.`);
  process.exit(0);
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
