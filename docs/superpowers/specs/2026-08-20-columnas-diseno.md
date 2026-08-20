# Filas de columnas en la vista previa

Fecha: 2026-08-20
Estado: aprobado, pendiente de plan de implementación

## Problema

MD Studio maqueta en una sola columna. Hoy dos imágenes solo pueden ir una debajo
de la otra. El objetivo es poder ponerlas lado a lado —y en general, repartir
cualquier contenido en columnas— desde la vista previa, con la misma soltura con
la que se hace en Word, y que eso sobreviva a la exportación a PDF, Word y HTML.

Esta es la **etapa 1** de dos. La etapa 2 (un lienzo libre estilo diapositiva,
con imágenes arrastrables a cualquier posición X/Y y superponibles) queda
explícitamente fuera de este diseño y tendrá su propio spec.

## Decisiones tomadas

| Decisión | Elección | Motivo |
| --- | --- | --- |
| Alcance | Filas en columnas, no lienzo libre | Fluye con el texto y exporta bien a los tres formatos |
| Contenido de una columna | Cualquier bloque Markdown | Pedido explícito: imagen + texto al lado, listas, citas, tablas |
| Sintaxis en el `.md` | Contenedores `:::` propios | Legible a mano; no obliga a activar HTML crudo en markdown-it |
| Word | Tabla real sin bordes | Es como Word maqueta esto; el contenido sigue siendo editable allí |
| Anchos | Separador arrastrable + presets | "Super maleable" era el pedido |
| Pruebas | Vitest sobre la lógica pura | El ida y vuelta `.md` ↔ HTML puede borrar contenido sin avisar |

Se descartó usar **tablas Markdown sin bordes** como truco de maquetación: las
celdas de tabla no admiten listas multilínea ni bloques de código, lo que choca
con el requisito de meter cualquier bloque Markdown dentro de una columna.

Se descartó **HTML embebido** (`<div class="md-cols">`): renderiza en GitHub y
Obsidian, pero obliga a `html: true` en markdown-it, y entonces cualquier
Markdown pegado de un tercero puede inyectar HTML arbitrario en el documento.

## Formato en el Markdown

```markdown
::: columnas
:: col 60
![Diagrama](img/diagrama.png)
*Figura 1 — el flujo completo*
:: col 40
### Puntos clave

- Primero esto
- Luego lo otro
:::
```

Reglas del formato:

- La apertura es una línea que contiene exactamente `::: columnas`, con una
  opción de alineación vertical opcional: `::: columnas centro`. Valores
  admitidos: `arriba` (por defecto), `centro`, `abajo`.
- Cada columna empieza con una línea `:: col`, opcionalmente seguida de un
  entero que es su **porcentaje de ancho**: `:: col 60`.
- El cierre es una línea que contiene exactamente `:::`.
- Si una fila no tiene ningún `:: col`, no es una fila de columnas y el bloque se
  trata como texto normal.
- **Normalización de anchos**, en este orden exacto:
  1. Las columnas sin número reparten a partes iguales lo que quede de 100 tras
     descontar las que sí lo llevan.
  2. Si lo que llevan número ya suma 100 o más, cada columna sin número recibe
     el mínimo (10%).
  3. Todo se escala proporcionalmente para que la suma final sea exactamente 100.
  4. Ninguna columna baja del 10%.
- **Sin anidamiento**: una fila de columnas no puede contener otra fila de
  columnas. Si el contenido de una columna incluye un `::: columnas`, ese texto
  se trata como texto plano. Es un límite consciente de la v1: anidar obliga a
  contar marcadores (`::::` dentro de `:::`), que es justo lo que vuelve
  ilegible esta sintaxis al editarla a mano.
- Un salto de página (`<!-- pagebreak -->`) dentro de una columna se ignora al
  exportar: partir una fila por la mitad no tiene un significado claro.

## Arquitectura

El ciclo que hay que mantener cerrado, porque un fallo en cualquier eslabón
borra contenido del usuario mientras edita:

```
.md  --parser-->  tokens  --renderer-->  HTML editable  --Turndown-->  .md
```

### `src/lib/columns.ts` (nuevo)

El módulo con el formato, sin dependencias de markdown-it ni de React. Es la
única definición de qué es una fila de columnas, y lo comparten el parser, el
conversor de vuelta, la interfaz y el exportador de Word.

- Constantes de los marcadores (`::: columnas`, `:: col`, `:::`).
- `parseColLine(line): { widthPercent: number | null } | null`
- `normalizeWidths(widths: (number | null)[]): number[]` — reparte, respeta el
  mínimo de 10% y garantiza que la suma sea 100.
- `buildRowHtml(columns, align): string` — el esqueleto HTML de una fila, usado
  tanto por el renderer como por el botón de la barra, para que una fila creada
  a mano y una creada con el botón sean idénticas (mismo patrón que ya sigue el
  salto de página).
- Los nombres de las clases y atributos del DOM (`md-cols`, `md-col`,
  `data-cols`, `data-w`, `data-align`), en un solo sitio.

### `src/lib/columnsPlugin.ts` (nuevo)

Una regla de bloque para markdown-it, siguiendo el estilo de la regla
`page_break` que ya existe en `markdown.ts`. No añade dependencias.

1. Reconoce la línea de apertura.
2. Busca la línea de cierre, sin descender a bloques anidados.
3. Corta el cuerpo en trozos por cada línea `:: col`.
   Tanto la búsqueda del cierre como este corte **ignoran las líneas que están
   dentro de un bloque de código con vallas** (` ``` ` o `~~~`). Sin eso, un
   bloque de código que contenga una línea `:::` trunca la fila y se pierde el
   resto del contenido — el caso exacto que el usuario encuentra documentando
   este mismo formato.
4. Por cada trozo, emite `columns_col_open` / `columns_col_close` y **re-tokeniza
   su contenido con el propio markdown-it**. Ese paso es el que hace que dentro
   de una columna quepa cualquier bloque Markdown: el contenido no lo interpreta
   esta regla, lo interpreta el parser completo.

Las reglas de renderizado producen:

```html
<div class="md-cols" data-cols data-align="arriba" contenteditable="false">
  <div class="md-col" data-w="60" style="flex: 60 1 0%" contenteditable="true">…</div>
  <div class="md-col" data-w="40" style="flex: 40 1 0%" contenteditable="true">…</div>
</div>
```

El envoltorio va `contenteditable="false"` para que el navegador lo trate como
un nodo atómico y el cursor no pueda romper la fila por la mitad al borrar.
Cada columna es una isla editable independiente dentro de él; los eventos de
tecleo siguen burbujeando al `onInput` de la región editable exterior, así que
`useEditableMarkdown` no necesita cambios.

El ancho vive en `data-w`, no en el `style`. El `style` se deriva de `data-w`.
Así el conversor de vuelta lee un entero en vez de parsear CSS.

`markdown.ts` solo cambia para registrar el plugin.

### `src/lib/htmlToMarkdown.ts` (modificado)

Una regla de Turndown que filtra por `[data-cols]`, recorre las columnas, llama
recursivamente a Turndown sobre el `innerHTML` de cada una, y re-emite el bloque
`:::` leyendo el ancho de `data-w` y la alineación de `data-align`.

Casos que la regla debe cubrir, porque el navegador los produce al editar:

- Una columna que quedó vacía → se emite igual, con su `:: col`, para no
  desbaratar el reparto de anchos.
- Una fila que quedó con una sola columna → se emite como contenido normal, sin
  el envoltorio `:::`. El contenido nunca se pierde, solo deja de estar en
  columnas.
- Una fila sin ningún `.md-col` dentro → no queda contenido que emitir, así que
  se descarta el envoltorio vacío.
- Contenido que el navegador dejó suelto dentro del envoltorio pero fuera de
  toda columna → se emite detrás de la fila, nunca se descarta.

### `src/styles/preview.css` (modificado)

```css
.md-cols  { display: flex; gap: 1em; margin: 1em 0; break-inside: avoid; }
.md-col   { min-width: 0; }
```

`min-width: 0` es obligatorio: sin él, una imagen ancha o una línea de código
larga desbordan la columna en lugar de encogerla. `break-inside: avoid` evita
que una fila se parta entre dos páginas al imprimir o exportar. La alineación
vertical sale de `data-align` mapeado a `align-items`.

Las imágenes dentro de una columna ya heredan el `max-width: 100%` que tiene
`.md-preview img`, así que se ajustan solas al ancho de su columna.

## Interacción en la vista previa

### Crear una fila

- **Botón "Columnas" en `EditorToolbar`** con un selector de 2 / 3 / 4. Inserta
  la fila vacía usando `buildRowHtml` más un párrafo detrás, para que el cursor
  tenga a dónde salir de la fila. Es el mismo patrón del botón de salto de
  página que ya existe.
- **Arrastrar una imagen al lado de otra**: al arrastrar una imagen del
  documento sobre el 25% izquierdo o derecho de otra imagen, aparece una guía
  vertical en ese borde; al soltar, las dos quedan en una fila de dos columnas
  al 50%. Si se suelta sobre el borde de una fila que ya existe, se añade como
  columna nueva y los anchos se re-reparten. Arrastrar un archivo de imagen
  desde el escritorio a esa misma zona hace lo mismo, porque entra por el mismo
  manejador de `drop`.

### Modificar una fila

- **Menú flotante**, al hacer clic en una fila: añadir columna, quitar columna,
  igualar anchos, alineación vertical (arriba / centro / abajo), eliminar fila.
  Se posiciona respecto al contenedor con el mismo cálculo que ya usa
  `ImageResizeHandle`, incluida la corrección por el zoom de la vista previa.
- **Separador arrastrable** entre dos columnas: reparte el ancho arrastrando.
  Reutiliza el mecanismo de `ImageResizeHandle` — delta de píxeles dividido por
  la escala en pantalla, `data-w` actualizado en vivo en las dos columnas
  vecinas, y `syncNow()` una sola vez al soltar, no en cada movimiento del
  ratón. Respeta el mínimo del 10% por columna.

### Reparto en componentes

`PreviewPane.tsx` hoy tiene 194 líneas y ya lleva dentro la selección de imagen.
Añadirle tres interacciones más lo convertiría en un nudo, así que la lógica
sale a hooks y el componente queda como puro ensamblaje:

| Archivo | Responsabilidad |
| --- | --- |
| `hooks/useImageSelection.ts` (nuevo) | La selección de imagen que hoy vive suelta en `PreviewPane` |
| `hooks/useColumnsRow.ts` (nuevo) | Fila seleccionada y sus mutaciones (añadir/quitar columna, igualar, alinear, eliminar) |
| `hooks/useImageSideDrop.ts` (nuevo) | El arrastre a un lado, la zona de destino y la guía |
| `components/ColumnsButton.tsx` (nuevo) | Botón de la barra con el selector 2/3/4 |
| `components/ColumnsRowMenu.tsx` (nuevo) | El menú flotante de la fila |
| `components/ColumnDivider.tsx` (nuevo) | Las manijas de reparto de ancho |

Cada mutación de fila sigue el mismo camino: toca el DOM y llama a `syncNow()`
de la región. Markdown sigue siendo la única fuente de verdad; ningún estado de
React duplica la estructura de la fila.

## Exportadores

- **HTML**: sin cambios. Re-renderiza el mismo Markdown con el mismo CSS.
- **PDF**: sin cambios de código. Rasteriza el mismo DOM y ya usa
  `pagebreak: { mode: ['css', 'avoid-all'] }`, que sumado al `break-inside:
  avoid` del CSS mantiene la fila entera en una página.
- **Word** (`exportDocx.ts`, modificado): un `convertColumnsRow` que construye
  una `Table` con `BorderStyle.NONE` en todos los bordes, una sola `TableRow`, y
  una `TableCell` por columna con su ancho en porcentaje. El contenido de cada
  celda se obtiene llamando recursivamente a `convertBlocks`, que es lo que hace
  que una lista siga siendo lista y una cita siga siendo cita dentro de la
  columna.

  **Arreglo que arrastra este cambio:** hoy `loadImageAsset` limita toda imagen
  sin ancho explícito a 500px, sin saber dónde va a caer. En una columna al 40%
  eso desborda la celda. Hay que acotar el ancho de la imagen al ancho real
  disponible en su columna, escalando el alto proporcionalmente, tanto para
  imágenes con `#w=NNN` como para las que no lo llevan.

  `preloadImages` y `collectImageSrcs` recorren la lista plana de tokens, así
  que siguen encontrando las imágenes dentro de columnas sin cambios.

## Pruebas

Se añade **Vitest** al proyecto, que hoy no tiene pruebas. Cubren solo la lógica
pura; el arrastre y los menús se verifican a mano en el navegador.

Casos que deben quedar cubiertos:

1. **Ida y vuelta completo**: un `.md` con una fila de dos columnas sobrevive a
   renderizar → convertir de vuelta, con las mismas columnas, anchos y contenido.
2. **Contenido anidado**: una columna con una lista, una cita y un bloque de
   código vuelve idéntica.
3. **Imagen con `#w=NNN`** dentro de una columna conserva su ancho.
4. **Normalización de anchos**: números que no suman 100, columnas sin número,
   y un ancho por debajo del mínimo.
5. **Casos degenerados**: fila sin `:: col`, fila sin cierre, columna vacía,
   fila de una sola columna.
6. **Aislamiento**: un `::: columnas` dentro de una columna se queda como texto
   plano, no rompe el bloque exterior.
7. **No regresión**: los documentos existentes (encabezados, listas, tablas,
   saltos de página, citas) siguen dando el mismo ida y vuelta que hoy.

## Verificación manual

En el navegador, sobre un documento real:

1. Insertar una fila de 2 columnas con el botón, meter una imagen en cada una.
2. Arrastrar una tercera imagen al lado derecho de una existente.
3. Repartir los anchos con el separador y comprobar que el `.md` del editor de
   texto refleja los nuevos números.
4. Editar texto dentro de una columna y comprobar que el cursor no salta ni se
   pierde contenido.
5. Eliminar una columna y luego la fila entera.
6. Exportar a PDF, HTML y Word y comprobar que las tres salidas muestran las
   columnas con los anchos elegidos, y que en Word el texto sigue siendo
   editable.
