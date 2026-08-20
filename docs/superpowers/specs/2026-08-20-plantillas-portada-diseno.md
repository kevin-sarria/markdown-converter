# Plantillas de portada

Fecha: 2026-08-20
Estado: aprobado, pendiente de plan de implementación

## Problema

Una portada en lienzo cuesta trabajo montarla: colocar los logos, alinearlos,
ajustar el título. Hoy ese trabajo vive dentro de un solo archivo y muere con la
pestaña — la app no guarda nada, así que al recargar se pierde todo.

Hacen falta dos cosas:

1. **Aplicar** una portada ya montada a los demás archivos cargados, sin
   rehacerla en cada uno.
2. **Guardarla y recuperarla** después, para usarla en documentos que todavía no
   existen.

## Decisiones tomadas

| Decisión | Elección | Motivo |
| --- | --- | --- |
| Qué guarda | El lienzo **y** el estilo | Solo el lienzo se ve distinto en un documento con otra tipografía o tamaño de página |
| Dónde entra al aplicarla | En la ranura de portada | Ya existe, va separada del cuerpo y no toca el Markdown del usuario |
| Cómo se guarda | Archivo descargable **y** biblioteca en el navegador | El archivo es portable y no se pierde; la biblioteca es lo cómodo del día a día |
| Formato del archivo | JSON propio, validado al importar | Fidelidad exacta y un fallo claro cuando llega algo que no es una plantilla |
| Portada existente | Avisar antes de reemplazar | Aplicar a veinte archivos puede tirar trabajo hecho a mano, y no hay deshacer |

## Qué es una plantilla

```ts
interface DocTemplate {
  /** Sube solo si el formato deja de ser compatible hacia atrás. */
  version: 1
  name: string
  /** ISO 8601, para ordenar la biblioteca y saber qué es cada cosa. */
  createdAt: string
  /** El Markdown de la portada — normalmente un bloque ::: lienzo. */
  cover: string
  /** Todo lo que decide cómo se ve, menos la propia portada. */
  style: Omit<DocSettings, 'coverPage'>
}
```

Las imágenes viajan dentro como `data:` URI, igual que ya lo hacen en el resto
del documento (ver `imageOptimize.ts`). Una plantilla es por tanto autosuficiente:
se abre en otro equipo y conserva sus logos, sin rutas rotas.

**El coste de eso:** una plantilla con dos logos ronda los cientos de KB. Como
archivo suelto da igual; el almacenamiento del navegador tiene un tope de unos
5 MB, así que la biblioteca aguanta del orden de diez o quince plantillas con
imágenes. Cuando se llene hay que decirlo con un mensaje claro, nunca fallar en
silencio (ver *Errores* más abajo).

## Arquitectura

### `src/lib/docTemplate.ts` (nuevo)

El formato y las dos operaciones que lo usan. Sin React, sin almacenamiento.

- `templateFromDoc(doc: DocFile, name: string): DocTemplate`
- `applyTemplate(doc: DocFile, template: DocTemplate): DocFile` — devuelve un
  documento nuevo con la portada y el estilo de la plantilla, **conservando su
  `markdown`, su `name` y su `id`**. Que aplicar a veinte archivos no toque el
  contenido de ninguno es la garantía central de esta función.

  Además deja la portada **activada** (`coverPage.enabled = true`). Una plantilla
  aplicada que no se ve no sirve de nada, y el archivo destino bien puede tener
  la portada apagada.
- `serializeTemplate(t): string` y `parseTemplate(text: string): DocTemplate | null`

`parseTemplate` **valida y nunca lanza**. Devuelve `null` ante un JSON inválido,
un objeto sin los campos esperados, o una `version` que no reconoce. Lo que entra
por aquí es un archivo que eligió el usuario, y puede ser cualquier cosa.

### `src/lib/templateStore.ts` (nuevo)

La biblioteca del navegador, sobre `localStorage`. Es la primera vez que esta app
guarda algo, así que el módulo asume que el almacenamiento puede estar lleno,
deshabilitado o contener basura de una versión anterior.

- `listTemplates(): DocTemplate[]` — descarta en silencio las entradas
  ilegibles en lugar de tirar la biblioteca entera por una corrupta.
- `saveTemplate(t): { ok: true } | { ok: false; reason: 'full' | 'unavailable' }` —
  el nombre identifica la plantilla, así que guardar con un nombre existente lo
  sobrescribe. Preguntar antes es cosa del panel, no del almacén.
- `deleteTemplate(name): void`

El resultado de `saveTemplate` es un valor, no una excepción: el llamador tiene
que decidir qué mensaje enseñar, y un `throw` acabaría como un fallo silencioso.

### `src/components/FileTargetPicker.tsx` (nuevo, extraído)

"Todos los archivos / Elegir archivos…" con su lista de casillas. Hoy vive dentro
de `ApplySettingsMenu`; aplicar una plantilla necesita exactamente lo mismo, así
que se extrae en vez de escribir un segundo igual. `ApplySettingsMenu` pasa a
usarlo, sin cambiar lo que hace.

### `src/components/TemplatePanel.tsx` (nuevo)

La sección **Plantilla de portada** del panel de ajustes:

- **Guardar la portada actual como plantilla…** — pide nombre y la mete en la
  biblioteca. Deshabilitado si la portada está vacía, porque guardar una portada
  en blanco no significa nada.
- **Exportar** — descarga `<nombre>.plantilla.json`.
- **Importar** — selector de archivo; si `parseTemplate` devuelve `null`, un
  mensaje que diga que el archivo no es una plantilla de MD Studio.
- **La biblioteca** — cada plantilla con su nombre y fecha, un botón *Aplicar
  a…* (que abre el `FileTargetPicker`) y uno de eliminar.

## Confirmación antes de reemplazar

Antes de aplicar, se cuentan los archivos destino que ya tienen una portada con
contenido (`hasCoverContent`, que ya existe en `coverPage.ts`). Si hay alguno, se
pide confirmación diciendo **cuántos** son y **cuáles**, no un "¿estás seguro?"
genérico — la diferencia entre reemplazar una portada vacía y tirar el trabajo de
tres es justo lo que el usuario necesita saber para decidir.

Si ninguno tiene portada, se aplica sin preguntar: no hay nada que perder.

## Errores

Todo lo que puede ir mal aquí viene de fuera del programa, así que cada caso
tiene una salida definida en vez de una excepción:

| Situación | Qué pasa |
| --- | --- |
| El archivo importado no es JSON, o no es una plantilla | Mensaje: no es una plantilla de MD Studio. La biblioteca no se toca. |
| El archivo es de una versión desconocida | Mismo mensaje. Mejor rechazar que aplicar algo a medias. |
| El almacenamiento está lleno | Mensaje que dice que la biblioteca está llena y que se pueden borrar plantillas o exportarlas a un archivo. La plantilla no se pierde: sigue en pantalla para exportarla. |
| `localStorage` no disponible (modo privado, permisos) | La biblioteca se muestra vacía y deshabilitada, con la razón. Exportar e importar siguen funcionando. |
| Una entrada guardada está corrupta | Se ignora esa entrada; el resto de la biblioteca se lista igual. |
| Se guarda con un nombre que ya existe | Se pide confirmación para sobrescribir. |

## Pruebas

Sobre la lógica pura; el panel se verifica a mano en el navegador.

1. **Ida y vuelta**: construir desde un documento → serializar → parsear →
   aplicar deja portada y estilo idénticos.
2. **Aplicar no toca el contenido**: el `markdown`, el `name` y el `id` del
   documento destino salen intactos.
3. **Aplicar a varios**: cada documento recibe la portada y conserva lo suyo.
4. **Entrada inválida**: JSON roto, JSON válido que no es una plantilla, versión
   desconocida, campos faltantes — todos devuelven `null` sin lanzar.
5. **Biblioteca**: guardar, listar, borrar; una entrada corrupta no impide listar
   las demás; el almacenamiento lleno devuelve `full`; sin `localStorage`
   devuelve `unavailable`.
6. **No regresión**: `ApplySettingsMenu` sigue aplicando el estilo igual que
   antes tras la extracción del selector.

## Verificación manual

1. Montar una portada en lienzo con dos logos y guardarla como plantilla.
2. Cargar tres `.md` y aplicarles la plantilla a todos; comprobar que las tres
   portadas salen idénticas y que el contenido de cada archivo sigue intacto.
3. Exportar la plantilla, recargar la página (se pierde todo), importarla y
   comprobar que vuelve con sus logos.
4. Aplicar sobre un archivo que ya tenía portada y comprobar el aviso.
5. Importar un archivo cualquiera que no sea una plantilla y ver el mensaje.
6. Exportar a PDF uno de los archivos y comprobar que la portada sale bien.
