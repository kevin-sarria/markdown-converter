# Formato de texto y color en el lienzo

Fecha: 2026-08-26
Estado: aprobado, pendiente de plan de implementación

## Problema

La barra flotante que aparece sobre un cuadro del lienzo (`CanvasStyleBar` /
`CanvasItemMenu`) solo controla tamaño, color, alineación y tipografía **de la
caja entera**. Para poner una palabra en negrita o hacer una lista hay que
subir la vista hasta la barra de arriba (`EditorToolbar`) — funciona, pero
ninguna de las dos barras muestra qué está activo, así que se sienten como dos
sistemas desconectados en vez de uno solo.

Además el color de la caja son cuatro swatches fijos del tema más un
`<input type="color">` desnudo — no hay forma de pintar solo unas palabras de
otro color, como en Word o PowerPoint.

## Decisiones tomadas

| Decisión | Elección | Motivo |
| --- | --- | --- |
| Dos barras o una | Se mantienen las dos, pero sincronizadas | Elegido explícitamente sobre unificarlas en una sola |
| Alcance del color nuevo | Por selección de texto, como Word | Elegido explícitamente sobre "un color por caja" |
| Color base de la caja | Se conserva como valor por defecto | Un cuadro simple de un solo color sigue funcionando igual que hoy, sin tocarlo |
| Selector "Más colores…" | Nativo del sistema operativo | Menos código, cero mantenimiento, ya viene con rueda de color + hex + RGB |
| Dónde vive la sintaxis de color por palabra | Global (cualquier texto del documento) | Una sola regla en el parser; restringirla al lienzo no aporta nada y cuesta más código |
| Botón de color de texto en la barra de arriba | No se agrega | Fuera de lo pedido; el documento ya soporta la sintaxis, pero el botón queda solo en la barra del lienzo |

## Arquitectura

### `src/hooks/useTextFormatState.ts` (nuevo)

Lo que de verdad conecta las dos barras. Hoy ninguna muestra si el texto
seleccionado ya está en negrita — este hook lo resuelve una sola vez para que
ambas lo lean igual.

```ts
interface TextFormatState {
  bold: boolean
  italic: boolean
  underline: boolean
  list: 'bullet' | 'number' | null
  color: string | null
}
function useTextFormatState(): TextFormatState
```

Escucha `selectionchange` (documento) y recalcula con
`document.queryCommandState('bold' | 'italic' | 'underline')`,
`queryCommandState('insertUnorderedList' | 'insertOrderedList')` y
`queryCommandValue('foreColor')` (normalizado a hex con el mismo conversor
`rgb(...)` → `#hex` que ya hace falta para Turndown, ver abajo — un solo
lugar para esa conversión, reutilizado por los dos). `EditorToolbar` y la
barra del lienzo llaman al mismo hook; ninguna guarda su propio estado de
"qué está activo".

### `src/components/CanvasTextFormatBar.tsx` (nuevo)

Negrita / cursiva / subrayado / lista con viñetas / lista numerada + el botón
de color de texto, usando `document.execCommand` exactamente como
`EditorToolbar.tsx:63` ya hace (`exec(command, value)`, con el mismo cuidado
de `focusEditable`/`onMouseDown preventDefault` para no perder la selección).
No se reimplementa nada de manipulación de rango: es el mismo patrón, mismo
target (`editableRef` del documento — un cuadro en edición ya es una isla
`contenteditable="true"` dentro de él).

Cada botón se ve presionado según `useTextFormatState()`.

### `src/components/ColorPicker.tsx` (nuevo, compartido)

```ts
function ColorPicker(props: {
  value: string | null
  onChange: (hex: string) => void
  onClear?: () => void   // "volver al color del documento" / "quitar color"
  theme: Theme
}): JSX.Element
```

Tres filas:

1. Colores del tema (`heading`, `text`, `muted`, `accent` — los mismos cuatro
   swatches de hoy).
2. Paleta estándar: los diez tonos clásicos de Office
   (`#C00000 #FF0000 #FFC000 #FFFF00 #92D050 #00B050 #00B0F0 #0070C0 #002060 #7030A0`).
3. **Más colores…** — botón que dispara (`.click()`) un
   `<input type="color">` oculto; el selector del sistema operativo hace el
   resto.

Dos usos: el color de caja en `CanvasStyleBar` (reemplaza los 4 swatches +
input suelto de hoy) y el color de texto en `CanvasTextFormatBar`. Mismo
componente, distinto `onChange` — uno llama `setStyle({ color })`, el otro
`exec('foreColor', hex)`.

### `CanvasItemMenu.tsx` — cambio mínimo

Mientras `editingText` es `true`, se muestra `CanvasTextFormatBar` en vez del
botón "✎ Texto" — mismo patrón condicional que ya existe en el archivo
(línea 72). `CanvasStyleBar` no cambia de posición ni de responsabilidad:
sigue siendo solo estilo de caja.

## Color de texto por selección — sintaxis y recorrido

El documento es Markdown puro; Markdown no tiene forma nativa de decir "estas
palabras en azul". Se agrega una sintaxis mínima, inspirada en los *spans*
con atributos de Pandoc y coherente con el `clave=valor` que ya usan las
cajas (`:: en 10,12 30 color=#hex`):

```
[texto en azul]{color=#0B2A6B}
```

Se distingue de un enlace por lo que sigue al `]`: `(` es enlace, `{` es
span de color. El contenido entre corchetes se seguirá parseando como
inline normal, así que `[**negrita en azul**]{color=#0B2A6B}` funciona.

Recorrido de un cambio de color:

1. **Editar** — con texto seleccionado dentro de un cuadro en modo edición,
   `ColorPicker` → `exec('foreColor', hex)` pinta un `<span style="color:…">`
   en el DOM, igual que negrita hoy.
2. **Guardar** — nueva regla en `htmlToMarkdown.ts` (junto a las reglas de
   Turndown existentes) reconoce ese `<span>` y emite
   `[texto]{color=#hex}`. Normaliza `rgb(r,g,b)` → hex con la misma función
   que usa `useTextFormatState`.
3. **Parsear** — nueva regla en `md.inline.ruler` (registrada donde se arma
   la instancia compartida de markdown-it) reconoce `[texto]{color=#hex}` y
   empuja tokens `color_open` / `color_close` con el hex como atributo,
   volviendo a renderizar el `<span>` en pantalla.
4. **Exportar a Word** — `runsFromInline` (`exportDocx.ts:439`) ya recorre
   tokens abriendo/cerrando estado para negrita/cursiva/tachado exactamente
   con este patrón (`bold = true` en `strong_open`, vuelve a `base.bold` en
   `strong_close`). `color_open`/`color_close` hace lo mismo con una
   variable `color`, que empieza en `base.color` (el color de la caja) y se
   pisa mientras el span está abierto. Sin cambios en `readBoxStyle` — el
   color de caja sigue siendo el valor por defecto.

Como la regla del parser es global, `[texto]{color=#hex}` funciona en
cualquier parte del documento, no solo dentro de `::: lienzo`. El botón para
usarlo solo se agrega a la barra del lienzo, tal como se pidió.

## Pruebas

- **`exportDocxCanvas.test.ts`**: una caja con `[palabra]{color=#hex}`
  produce runs de Word con colores distintos para esa palabra y para el
  resto; sin ningún span, todo el texto sigue con el color de caja
  (`readBoxStyle`); un color-span dentro de texto en negrita conserva ambos
  (`bold: true` y el color).
- **Ida y vuelta**: como `canvasRoundTrip.test.ts` ya prueba con
  `**negrita**` — un span de color sobrevive
  DOM → `htmlToMarkdown` → `canvasPlugin` → DOM sin perder el hex.
- **Ambigüedad enlace/span**: `[texto](url)` sigue siendo un enlace;
  `[texto]{color=#hex}` no se confunde con uno.
- **`useTextFormatState`**: negrita/cursiva/lista se reportan `true` cuando
  el cursor está dentro de ese formato, `false` fuera de él.

## Verificación manual

1. En un cuadro del lienzo, seleccionar una palabra y ponerla en negrita
   desde la barra flotante nueva; confirmar que el botón de negrita de la
   barra de arriba también se ve presionado al mover el cursor sobre esa
   palabra.
2. Pintar una palabra de un color de la paleta estándar y otra con "Más
   colores…"; exportar a Word y abrir en LibreOffice — cada palabra debe
   salir con su color, el resto con el color de caja.
3. Hacer una lista con viñetas dentro de un cuadro desde la barra flotante;
   confirmar que se ve igual que una hecha desde la barra de arriba.
4. Guardar, recargar y reabrir el documento — los colores por palabra deben
   sobrevivir igual que ya sobrevive la negrita hoy.
