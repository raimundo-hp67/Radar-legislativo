'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { TriangleAlert, Loader2, Plus, X } from 'lucide-react';
import type { LegalProject } from '~/db/schema';

type ProjectFormProps = {
  project?: LegalProject
  onSuccess?: () => void
};

export function ProjectForm({ project, onSuccess }: ProjectFormProps) {
  const router = useRouter();
  const isEditing = !!project;

  const [formData, setFormData] = useState({
    boletin: project?.boletin || '',
    title: project?.title || '',
    relevance: project?.relevance || 'MEDIUM',
    dateIngreso: project?.dateIngreso || '',
    estado: project?.estado || '',
    camara: project?.camara || '',
    urgencia: project?.urgencia || '',
    comision: project?.comision || '',
    autores: project?.autores || '',
    objetivo: project?.objetivo || '',
    linkProyecto: project?.linkProyecto || '',
    linkInformes: (project?.linkInformes as string[]) || [],
    notes: project?.notes || '',
  });

  const addLinkInforme = () => {
    setFormData({
      ...formData,
      linkInformes: [...formData.linkInformes, ''],
    });
  };

  const removeLinkInforme = (index: number) => {
    setFormData({
      ...formData,
      linkInformes: formData.linkInformes.filter((_, i) => i !== index),
    });
  };

  const updateLinkInforme = (index: number, value: string) => {
    const newLinks = [...formData.linkInformes];
    newLinks[index] = value;
    setFormData({ ...formData, linkInformes: newLinks });
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const url = isEditing
        ? `/api/legal/projects/${project.id}`
        : '/api/legal/projects';
      const method = isEditing ? 'PUT' : 'POST';

      // Filter out empty links before submitting
      const dataToSubmit = {
        ...formData,
        linkInformes: formData.linkInformes.filter((link) => link.trim() !== ''),
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSubmit),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al guardar el proyecto');
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/legal');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="boletin">Boletín *</Label>
          <Input
            id="boletin"
            value={formData.boletin}
            onChange={(e) => setFormData({ ...formData, boletin: e.target.value })}
            placeholder="Ej: 17590-05"
            required
            disabled={isEditing}
          />
          {isEditing && (
            <p className="text-xs text-stone-500">
              El boletín no se puede modificar
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="relevance">Relevancia *</Label>
          <Select
            value={formData.relevance}
            onValueChange={(value) => setFormData({ ...formData, relevance: value })}
          >
            <SelectTrigger id="relevance">
              <SelectValue placeholder="Seleccionar relevancia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Baja</SelectItem>
              <SelectItem value="MEDIUM">Media</SelectItem>
              <SelectItem value="HIGH">Alta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Título *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Título del proyecto de ley"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="dateIngreso">Fecha de Ingreso</Label>
        <Input
          id="dateIngreso"
          type="date"
          value={formData.dateIngreso}
          onChange={(e) => setFormData({ ...formData, dateIngreso: e.target.value })}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="estado">Estado de Tramitación</Label>
          <Select
            value={formData.estado}
            onValueChange={(value) => setFormData({ ...formData, estado: value })}
          >
            <SelectTrigger id="estado">
              <SelectValue placeholder="Seleccionar estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Primer trámite">Primer trámite</SelectItem>
              <SelectItem value="Segundo trámite">Segundo trámite</SelectItem>
              <SelectItem value="Tercer trámite">Tercer trámite</SelectItem>
              <SelectItem value="Comisión mixta">Comisión mixta</SelectItem>
              <SelectItem value="Promulgado">Promulgado</SelectItem>
              <SelectItem value="Archivado">Archivado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="camara">Cámara Actual</Label>
          <Select
            value={formData.camara}
            onValueChange={(value) => setFormData({ ...formData, camara: value })}
          >
            <SelectTrigger id="camara">
              <SelectValue placeholder="Seleccionar cámara" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Diputados">Diputados</SelectItem>
              <SelectItem value="Senado">Senado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="urgencia">Urgencia</Label>
          <Select
            value={formData.urgencia}
            onValueChange={(value) => setFormData({ ...formData, urgencia: value })}
          >
            <SelectTrigger id="urgencia">
              <SelectValue placeholder="Seleccionar urgencia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Sin urgencia">Sin urgencia</SelectItem>
              <SelectItem value="Simple">Simple (30 días)</SelectItem>
              <SelectItem value="Suma">Suma (15 días)</SelectItem>
              <SelectItem value="Inmediata">Inmediata (6 días)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="comision">Comisión</Label>
          <Input
            id="comision"
            value={formData.comision}
            onChange={(e) => setFormData({ ...formData, comision: e.target.value })}
            placeholder="Ej: Hacienda, Economía..."
          />
        </div>
      </div>

      {/* Objetivo - Prominent section */}
      <div className="space-y-2 rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950/30">
        <Label htmlFor="objetivo" className="text-orange-700 dark:text-orange-300">
          Objetivo / Resumen del Proyecto
        </Label>
        <Textarea
          id="objetivo"
          value={formData.objetivo}
          onChange={(e) => setFormData({ ...formData, objetivo: e.target.value })}
          placeholder="Describe brevemente el objetivo principal del proyecto de ley..."
          rows={3}
          className="border-orange-200 dark:border-orange-800"
        />
      </div>

      {/* Autores */}
      <div className="space-y-2">
        <Label htmlFor="autores">Autores / Patrocinadores</Label>
        <Textarea
          id="autores"
          value={formData.autores}
          onChange={(e) => setFormData({ ...formData, autores: e.target.value })}
          placeholder="Nombres de los autores separados por coma. Ej: Francisco Chahuán, Juan Antonio Coloma..."
          rows={2}
        />
      </div>

      {/* Links externos */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="linkProyecto">Link al Proyecto (Cámara)</Label>
          <Input
            id="linkProyecto"
            type="url"
            value={formData.linkProyecto}
            onChange={(e) => setFormData({ ...formData, linkProyecto: e.target.value })}
            placeholder="https://camara.cl/..."
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Links a Informes Relevantes</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLinkInforme}
              className="h-7 px-2"
            >
              <Plus className="mr-1 h-3 w-3" />
              Agregar
            </Button>
          </div>
          {formData.linkInformes.length === 0
            ? (
                <p className="text-sm text-stone-500">No hay links agregados</p>
              )
            : (
                <div className="space-y-2">
                  {formData.linkInformes.map((link, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        type="url"
                        value={link}
                        onChange={(e) => updateLinkInforme(index, e.target.value)}
                        placeholder="https://..."
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLinkInforme(index)}
                        className="h-10 w-10 shrink-0 text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notas Adicionales</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Notas adicionales sobre el proyecto..."
          rows={3}
        />
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? 'Guardar Cambios' : 'Crear Proyecto'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/legal')}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
