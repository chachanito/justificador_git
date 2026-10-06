# Justificador de texto

Aplicación web independiente para justificar texto a un ancho configurable. Reutiliza y mejora la lógica del módulo original del ERP, pero no necesita PHP, base de datos ni autenticación.

## Funciones

- Pegar y justificar texto a 75 caracteres (o entre 30 y 140).
- Conservar viñetas, listas numeradas, líneas en blanco y sangrías de continuación.
- Importar `.txt`, `.md`, `.docx` y `.pdf`.
- Copiar el resultado o descargarlo como TXT, Word y PDF.
- Procesar los archivos localmente en el navegador; no se suben a un servidor.
- Usar la interfaz desde computador o celular.

## Uso rápido

1. Abre `index.html` en un navegador moderno.
2. Pega un texto o selecciona un archivo.
3. Ajusta el ancho de línea si lo necesitas.
4. Pulsa **Justificar texto** y descarga el formato deseado.

Para evitar restricciones locales del navegador, también puedes servir la carpeta con cualquier servidor estático. En XAMPP, copia el proyecto dentro de `htdocs` y abre:

```text
http://localhost/justificador_git/
```

## Publicar con GitHub Pages

1. Crea un repositorio y sube el contenido de esta carpeta.
2. En GitHub abre **Settings > Pages**.
3. Selecciona la rama principal y la carpeta raíz.

No hace falta un proceso de compilación.

## Pruebas

Las pruebas del núcleo usan el ejecutor incorporado de Node.js:

```bash
npm test
```

## Dependencias del navegador

La aplicación carga versiones fijadas de Mammoth, PDF.js, docx y jsPDF desde jsDelivr. El worker de PDF.js se incluye localmente para evitar bloqueos entre dominios. La primera apertura necesita conexión a Internet para las demás bibliotecas; si se requiere una instalación completamente sin conexión, estas también pueden descargarse y referenciarse desde `assets/vendor/`.

## Limitaciones

- Word: se admite `.docx`, no el formato antiguo `.doc`.
- PDF: el documento debe contener texto seleccionable. Los PDF creados desde escáner requieren OCR previo.
- La importación extrae el contenido textual; no intenta conservar imágenes, tablas ni el diseño visual del archivo de origen.
- El PDF exportado usa una fuente monoespaciada para conservar la alineación por caracteres.

## Licencia

MIT. Consulta [LICENSE](LICENSE).

Las dependencias de terceros conservan sus propias licencias; consulta [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
