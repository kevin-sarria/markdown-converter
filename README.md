# MD Studio

Convertidor de Markdown a PDF, Word (.docx) y HTML, 100% frontend — nada se sube a
ningún servidor. Editor con vista previa en vivo, paletas de color y tipografías
seleccionables, tamaño de página y márgenes configurables.

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

Los exportadores de PDF/Word se cargan de forma diferida (`import()` dinámico)
para que la carga inicial de la página sea liviana.
