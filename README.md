# MD Studio

Convertidor de Markdown a PDF, Word (.docx) y HTML, 100% frontend — nada se sube a
ningún servidor. Editor con vista previa en vivo, paletas de color y tipografías
seleccionables, tamaño de página y márgenes configurables, y maquetación en
columnas para poner imágenes y texto lado a lado.

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
