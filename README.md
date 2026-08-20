# MD Studio

Convertidor de Markdown a PDF, Word (.docx) y HTML, 100% frontend — nada se sube a
ningún servidor. Editor con vista previa en vivo, paletas de color y tipografías
seleccionables, tamaño de página y márgenes configurables, maquetación en
columnas, y páginas en lienzo donde colocás cada elemento a mano como en
PowerPoint.

## Uso

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`, pega o sube un archivo `.md`, ajusta el estilo desde
el panel derecho ("Estilo") y exporta con los botones de la barra superior.

## Build de producción

```bash
npm run build   # genera dist/
npm run preview # sirve dist/ localmente para probarlo
```

`dist/` es estático — puede abrirse con cualquier servidor de archivos o alojarse
en cualquier hosting estático (no requiere backend).

## Páginas en lienzo (colocar todo a mano)

Cuando el texto que fluye estorba —una portada, una carátula, una diapositiva—
usá el botón **⬚ Lienzo** de la barra. Inserta una página del tamaño exacto de
una hoja impresa donde colocás cada cosa donde quieras:

- **Clic** en un elemento para seleccionarlo, **arrastrá** para moverlo.
- **Esquinas** para cambiar el tamaño. Las imágenes escalan proporcionalmente,
  así que un logo no puede salir estirado.
- Al arrastrar aparecen **guías** cuando te alineás con el centro de la página o
  con otro elemento, y el elemento se imanta ahí. Centrar dos logos deja de ser
  cuestión de buen pulso.
- **Flechas del teclado** para el ajuste fino (con Shift, saltos más grandes).
- **Doble clic** en un elemento para escribir dentro. Mientras no lo hagas, el
  elemento no es editable: por eso un arrastre mueve la caja en vez de entregarle
  el contenido al navegador.
- **Clic en un hueco** de la página para añadir texto o una imagen justo ahí.

En el `.md` se guarda así:

```markdown
::: lienzo
:: en 30,15 18
![Logo A](logo-a.png)
:: en 52,15 18
![Logo B](logo-b.png)
:: en 10,45 80
# Entorno de producción
:::
```

`:: en X,Y W` coloca la esquina superior izquierda del elemento en X,Y y le da un
ancho W; `WxH` fija también el alto, y sin H el elemento crece con su contenido.
Todo va en **porcentajes de la página**, nunca en milímetros: así la maquetación
no se descoloca al cambiar de A4 a Carta ni al ajustar los márgenes.

Una página en lienzo ocupa exactamente una página impresa. En PDF y HTML sale tal
cual. En Word cada elemento llega anclado a su posición con un marco, así que el
texto sigue siendo editable ahí (no es una imagen aplanada).

## Plantillas de portada

Una portada que costó montar no tiene por qué montarse dos veces. En la pestaña
**Encabezado / Marca de agua**, la sección **Plantilla de portada**:

- **Guardar esta portada como plantilla…** — le ponés nombre y queda en la
  biblioteca de este navegador.
- **Aplicar a…** — se la ponés a un archivo, a los que elijas, o a todos de una.
- **Exportar** / **Importar** — la bajás como archivo `.plantilla.json` y la
  volvés a cargar cuando la necesites, en este equipo o en otro.

Una plantilla guarda **la portada y el estilo** (paleta, tipografía, tamaño de
página, márgenes, encabezado/pie, marca de agua), con **los logos dentro**: se
abre en otro equipo y sigue completa, sin rutas rotas.

Aplicarla reemplaza la portada y el estilo del archivo destino y **no toca su
contenido ni su nombre**. Si el archivo ya tenía una portada, avisa antes —
diciendo cuántos archivos y cuáles, no un "¿estás seguro?" a secas.

Hay dos formas de guardarla porque fallan distinto: la biblioteca del navegador
es lo cómodo del día a día pero desaparece si limpiás los datos del navegador o
cambiás de equipo; el archivo exportado sobrevive a cualquier cosa pero hay que
volver a encontrarlo. Como los logos viajan dentro, una plantilla pesa cientos de
KB, así que la biblioteca aguanta del orden de diez o quince — cuando se llene te
lo dice y podés exportar las que no uses.

## Contenido en columnas

Para poner dos imágenes (o cualquier contenido) una al lado de la otra, hay tres
formas, todas equivalentes:

- El botón **Columnas** de la barra del editor, que pide cuántas querés.
- Arrastrar una imagen sobre el borde izquierdo o derecho de otra.
- Escribirlo a mano en el Markdown.

Una vez creada la fila, hacé clic en ella para que aparezcan su menú (añadir o
quitar columnas, igualar anchos, alineación vertical) y los separadores, que se
arrastran para repartir el ancho.

En el `.md` se guarda así:

```markdown
::: columnas centro
:: col 60
![Diagrama](diagrama.png)
*Figura 1*
:: col 40
### Puntos clave

- Primero esto
- Luego lo otro
:::
```

`::: columnas` abre la fila y `:::` la cierra; cada `:: col` empieza una columna
y el número que la sigue es su porcentaje de ancho (si no está, se reparten en
partes iguales). La palabra tras `columnas` es la alineación vertical:
`arriba` (por defecto), `centro` o `abajo`. Dentro de una columna entra
cualquier bloque de Markdown. La única limitación es que no se pueden anidar
columnas dentro de columnas.

En PDF y HTML sale tal cual se ve. En Word llega como una tabla real sin bordes
—que es como Word maqueta esto— así que el texto sigue siendo editable ahí.

## Cómo está armado

- **Editor + vista previa**: `markdown-it` renderiza el Markdown a HTML en vivo.
- **Estilos**: cada paleta de color y tipografía (`src/lib/themes.ts`) se aplica
  como variables CSS (`src/lib/previewStyle.ts`) tanto en la vista previa como en
  el HTML/PDF exportado, para que "lo que ves es lo que exportas".
- **Exportar a PDF**: `html2pdf.js` (html2canvas + jsPDF) rasteriza el nodo de
  vista previa exacto que se ve en pantalla.
- **Exportar a Word**: no es HTML disfrazado — `src/lib/exportDocx.ts` recorre los
  tokens de `markdown-it` y construye un `.docx` real (encabezados, listas
  anidadas, tablas, citas, bloques de código, imágenes remotas) con la librería
  `docx`, aplicando la misma paleta/tipografía elegidas. Para temas oscuros, el
  texto sin fondo propio se ajusta a un color legible sobre el papel blanco de
  Word (los bloques con fondo propio —código, citas, encabezado de tabla—
  conservan los colores del tema tal cual).
- **Exportar a HTML**: genera un archivo autocontenido (CSS embebido, fuentes de
  Google Fonts enlazadas) que se puede abrir u hospedar donde sea.
- **Plantillas**: `src/lib/docTemplate.ts` define el formato y las dos
  operaciones (construir desde un documento, aplicar a otro); `templateStore.ts`
  es la biblioteca sobre `localStorage` — lo único que esta app persiste, y por
  eso el módulo asume que el almacenamiento puede estar lleno, apagado o con
  basura de otra versión, y nunca lanza.
- **Lienzo**: `src/lib/canvas.ts` define el formato (posiciones en porcentaje),
  `canvasPlugin.ts` lo parsea, `canvasSnap.ts` calcula el imantado y las guías, y
  `useCanvasEditor.ts` maneja arrastrar, redimensionar y editar. Los elementos se
  renderizan **no editables** a propósito: un elemento editable entrega el
  arrastre a `contentEditable`, que decide por su cuenta dónde acaba el nodo.
- **Columnas**: `src/lib/columns.ts` define el formato; `columnsPlugin.ts` lo
  parsea (re-tokenizando el contenido de cada columna con el propio markdown-it,
  que es lo que permite meter cualquier bloque dentro) y una regla de Turndown en
  `htmlToMarkdown.ts` lo devuelve a Markdown. Las ediciones de una fila son
  operaciones de DOM en `columnsDom.ts`.

## Pruebas

```bash
npm test
```

Cubren la lógica pura: el ida y vuelta `.md` ↔ HTML (donde un fallo borraría
contenido mientras se escribe), la aritmética de anchos, las mutaciones de fila
y la tabla que sale hacia Word.

Los exportadores de PDF/Word se cargan de forma diferida (`import()` dinámico)
para que la carga inicial de la página sea liviana.
