import * as z from 'zod';

export const relevanceSchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);

export const createProjectSchema = z.object({
  boletin: z.string().min(1, 'El boletín es requerido').max(20),
  title: z.string().min(1, 'El título es requerido'),
  relevance: relevanceSchema,
  dateIngreso: z.string().optional().nullable(),
  estado: z.string().optional().nullable(),
  camara: z.string().optional().nullable(),
  urgencia: z.string().optional().nullable(),
  comision: z.string().optional().nullable(),
  // Enhanced fields
  autores: z.string().optional().nullable(),
  objetivo: z.string().optional().nullable(),
  linkProyecto: z.string().url('Debe ser una URL válida').optional().nullable().or(z.literal('')),
  linkInformes: z.array(z.string().url('Cada link debe ser una URL válida')).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateProjectSchema = z.object({
  boletin: z.string().min(1).max(20).optional(),
  title: z.string().min(1).optional(),
  relevance: relevanceSchema.optional(),
  dateIngreso: z.string().optional().nullable(),
  estado: z.string().optional().nullable(),
  camara: z.string().optional().nullable(),
  urgencia: z.string().optional().nullable(),
  comision: z.string().optional().nullable(),
  // Enhanced fields
  autores: z.string().optional().nullable(),
  objetivo: z.string().optional().nullable(),
  linkProyecto: z.string().url('Debe ser una URL válida').optional().nullable().or(z.literal('')),
  linkInformes: z.array(z.string().url('Cada link debe ser una URL válida')).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
