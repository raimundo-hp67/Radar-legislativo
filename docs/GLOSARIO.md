# Glosario — conceptos de la herramienta y del proceso legislativo

Para usar el Radar no necesitas ser abogado, pero estos términos aparecen por toda la interfaz. Aquí está qué significa cada uno **y qué efecto tiene dentro de la herramienta**.

## Del proceso legislativo chileno

### Boletín
El **número único que identifica un proyecto de ley** en el Congreso, con formato `NNNNN-CC` (ej: `17618-19`). La primera parte es un correlativo; el sufijo indica la comisión/materia de origen. Es la "llave" con la que el Radar sigue cada proyecto: se agrega un proyecto por su boletín y todas las consultas al Senado se hacen con él. Puedes buscar boletines en [senado.cl](https://tramitacion.senado.cl) o con el buscador de la pestaña **Investigación**.

### Etapa / Estado
Dónde va el proyecto en su tramitación: *Primer trámite constitucional* (cámara de origen), *Segundo trámite* (cámara revisora), *Comisión Mixta*, *Tramitación terminada*, etc. Un cambio de etapa es de las señales más importantes — por eso el Radar lo considera **cambio significativo** (dispara alertas).

### Cámara
Dónde se está tramitando actualmente: **Senado** o **Cámara de Diputados**.

### Urgencia
Herramienta del Ejecutivo para acelerar un proyecto. Define el plazo máximo de discusión:
- **Simple**: 30 días
- **Suma**: 15 días
- **Discusión inmediata**: 6 días
- **Sin urgencia**: sin plazo

Que un proyecto reciba urgencia es una señal política fuerte (el gobierno lo quiere mover). El Radar trata los cambios de urgencia como **significativos** y el módulo de alertas destaca los proyectos con urgencia suma o inmediata.

### Comisión
El grupo de parlamentarios que estudia el proyecto en detalle (ej: Comisión de Hacienda). Los proyectos pasan la mayor parte de su vida en comisiones.

### Último trámite
La acción más reciente registrada en la tramitación (ej: "Cuenta de proyecto", "Aprobado en general"). Cambia con frecuencia; no siempre implica avance de etapa.

## De la Ley de Lobby (20.730)

### Audiencia de lobby
Reunión registrada entre una **autoridad pública** y quien busca influir en sus decisiones. Por ley quedan en un registro público, que es lo que el Radar sincroniza.

### Sujeto pasivo
La **autoridad** que recibe la audiencia (ministro, superintendente, parlamentario…). En el Radar: la columna "institución" y el lado izquierdo de los cruces.

### Sujeto activo
Quien **solicita** la audiencia (empresa, gremio, lobbista, ONG…). En el Radar: "organización/persona" y el lado derecho de los cruces.

### Materia
El tema declarado de la audiencia. Es texto libre; el buscador del explorador busca sobre él.

## De la herramienta

### Relevancia (HIGH / MEDIUM / LOW)
La **prioridad que TÚ le asignas** a cada proyecto al crearlo o editarlo — no es un dato del Congreso. Tiene efectos concretos:
- **HIGH**: se consulta al Senado en **cada** actualización (no solo cuando la API reporta cambios), y si tiene un cambio significativo se envía **alerta inmediata a Slack**. El dashboard lo cuenta en "Alta Prioridad".
- **MEDIUM / LOW**: se actualiza cuando el Senado reporta movimiento; sus cambios solo aparecen en el digest y en la página de Cambios.

Regla práctica: HIGH para lo que te afecta directamente, MEDIUM para lo que observas, LOW para contexto.

### Snapshot
Una **"foto" del estado del proyecto** (etapa, cámara, urgencia, comisión, último trámite) tomada cada vez que el Radar consulta al Senado. El historial de snapshots es lo que ves en la línea de tiempo del detalle de cada proyecto.

### Diff / Cambio detectado
La **comparación entre el snapshot nuevo y el anterior**, campo por campo. Si algo cambió, queda registrado como "cambio detectado" (visible en `/legal/changes` y en el detalle del proyecto). Los cambios de **etapa, cámara o urgencia** se consideran *significativos* y son los que disparan alertas inmediatas para proyectos HIGH.

### Cache de proyectos (buscador)
Una copia local de proyectos del Senado que alimenta el buscador de la pestaña **Investigación**. Se puebla con `bun run scripts/bulk-sync.ts` y es independiente de tus proyectos en seguimiento: buscar ahí no agrega nada a tu radar hasta que tú lo agregues.

### Alertas
El módulo de la pestaña Proyectos que destaca: proyectos HIGH con cambios recientes, proyectos con urgencia suma/inmediata, y proyectos sin actualizar hace más de 14 días.
