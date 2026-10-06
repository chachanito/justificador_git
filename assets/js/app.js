import { clampWidth, justifyText, textStats } from './justifier.js';

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const PDF_WORKER_URL = new URL('../vendor/pdf.worker.min.js', import.meta.url).href;

const elements = {
    fileInput: document.querySelector('#file-input'),
    dropZone: document.querySelector('#drop-zone'),
    fileInfo: document.querySelector('#file-info'),
    fileName: document.querySelector('#file-name'),
    removeFile: document.querySelector('#remove-file'),
    source: document.querySelector('#source-text'),
    width: document.querySelector('#line-width'),
    status: document.querySelector('#status'),
    result: document.querySelector('#result-text'),
    stats: document.querySelector('#stats'),
    clear: document.querySelector('#clear-button'),
    justify: document.querySelector('#justify-button'),
    copy: document.querySelector('#copy-button'),
    txt: document.querySelector('#download-txt'),
    docx: document.querySelector('#download-docx'),
    pdf: document.querySelector('#download-pdf'),
};

let currentResult = '';
let currentBaseName = 'texto_justificado';

function setStatus(message = '', type = '') {
    elements.status.textContent = message;
    elements.status.dataset.type = type;
}

function setExportState(enabled) {
    [elements.copy, elements.txt, elements.docx, elements.pdf].forEach((button) => {
        button.disabled = !enabled;
    });
}

function safeBaseName(name) {
    const withoutExtension = name.replace(/\.[^.]+$/u, '');
    const cleaned = withoutExtension.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return cleaned ? `${cleaned}_justificado` : 'texto_justificado';
}

function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function runJustifier({ scroll = true } = {}) {
    const source = elements.source.value;
    if (!source.trim()) {
        setStatus('Escribe o carga un texto antes de justificar.', 'error');
        elements.source.focus();
        return;
    }

    const width = clampWidth(elements.width.value);
    elements.width.value = String(width);
    currentResult = justifyText(source, width);
    elements.result.textContent = currentResult;
    document.querySelector('#result-panel').classList.add('is-visible');

    const stats = textStats(currentResult);
    elements.stats.textContent = `${stats.lines} líneas · máximo ${stats.longestLine} caracteres`;
    setExportState(true);
    setStatus(`Texto justificado a ${width} caracteres.`, 'success');

    if (scroll) {
        document.querySelector('#result-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}

function pdfItemsToParagraphs(items) {
    const textItems = items.filter((item) => typeof item.str === 'string' && item.str.trim());
    const rows = [];

    for (const item of textItems) {
        const x = item.transform?.[4] ?? 0;
        const y = item.transform?.[5] ?? 0;
        let row = rows.find((candidate) => Math.abs(candidate.y - y) <= 2.5);
        if (!row) {
            row = { y, height: item.height || 10, items: [] };
            rows.push(row);
        }
        row.items.push({ x, text: item.str.trim() });
    }

    rows.sort((a, b) => b.y - a.y);
    rows.forEach((row) => row.items.sort((a, b) => a.x - b.x));
    const lineRows = rows.map((row) => ({
        y: row.y,
        height: row.height,
        text: row.items.map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim(),
    }));

    const gaps = lineRows.slice(1).map((row, index) => lineRows[index].y - row.y).filter((gap) => gap > 0);
    const normalGap = median(gaps) || 12;
    const paragraphs = [];
    let paragraph = '';

    lineRows.forEach((row, index) => {
        const previous = lineRows[index - 1];
        const gap = previous ? previous.y - row.y : 0;
        const startsList = /^(?:(?:\d{1,3}|[A-Za-z])[.)]|[•●▪◦‣➢►*+>º-])\s+/u.test(row.text);
        const newParagraph = Boolean(previous && (gap > normalGap * 1.55 || startsList));

        if (newParagraph && paragraph) {
            paragraphs.push(paragraph.trim());
            paragraph = '';
        }

        if (paragraph.endsWith('-') && /^[a-záéíóúüñ]/u.test(row.text)) {
            paragraph = paragraph.slice(0, -1) + row.text;
        } else {
            paragraph += `${paragraph ? ' ' : ''}${row.text}`;
        }
    });

    if (paragraph) paragraphs.push(paragraph.trim());
    return paragraphs.join('\n');
}

async function extractPdf(file) {
    if (!window.pdfjsLib) throw new Error('No se pudo cargar el lector de PDF. Revisa tu conexión a Internet.');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
    const data = new Uint8Array(await file.arrayBuffer());
    setStatus('Abriendo el documento PDF…');
    const documentTask = window.pdfjsLib.getDocument({ data });
    const pdf = await documentTask.promise;
    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        setStatus(`Leyendo PDF: página ${pageNumber} de ${pdf.numPages}…`);
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const pageText = pdfItemsToParagraphs(textContent.items);
        if (pageText) pages.push(pageText);
    }

    if (!pages.length) {
        throw new Error('El PDF no contiene texto seleccionable. Si es escaneado, primero debes aplicarle OCR.');
    }
    return pages.join('\n\n');
}

async function extractDocx(file) {
    if (!window.mammoth) throw new Error('No se pudo cargar el lector de Word. Revisa tu conexión a Internet.');
    const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value.replace(/\n{3,}/g, '\n\n').trim();
}

async function extractFile(file) {
    if (file.size > MAX_FILE_SIZE) throw new Error('El archivo supera el límite de 20 MB.');
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension === 'txt' || extension === 'md') return file.text();
    if (extension === 'docx') return extractDocx(file);
    if (extension === 'pdf') return extractPdf(file);
    if (extension === 'doc') throw new Error('El formato .doc antiguo no es compatible. Guárdalo como .docx e inténtalo otra vez.');
    throw new Error('Formato no compatible. Usa TXT, MD, DOCX o PDF.');
}

async function handleFile(file) {
    if (!file) return;
    setStatus(`Leyendo ${file.name}…`);
    elements.justify.disabled = true;
    try {
        const text = await extractFile(file);
        if (!text.trim()) throw new Error('No se encontró texto utilizable en el archivo.');
        elements.source.value = text;
        elements.fileName.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;
        elements.fileInfo.hidden = false;
        currentBaseName = safeBaseName(file.name);
        runJustifier({ scroll: false });
    } catch (error) {
        setStatus(error instanceof Error ? error.message : 'No fue posible leer el archivo.', 'error');
        elements.fileInput.value = '';
    } finally {
        elements.justify.disabled = false;
    }
}

async function copyResult() {
    try {
        await navigator.clipboard.writeText(currentResult);
        setStatus('Resultado copiado al portapapeles.', 'success');
    } catch {
        const range = document.createRange();
        range.selectNodeContents(elements.result);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand('copy');
        selection.removeAllRanges();
        setStatus('Resultado copiado al portapapeles.', 'success');
    }
}

async function downloadDocx() {
    if (!window.docx) {
        setStatus('No se pudo cargar el exportador de Word. Revisa tu conexión a Internet.', 'error');
        return;
    }
    const { Document, Packer, Paragraph, TextRun } = window.docx;
    const children = currentResult.split('\n').map((line) => new Paragraph({
        spacing: { after: 0, line: 240 },
        children: [new TextRun({ text: line || ' ', font: 'Courier New', size: 20 })],
    }));
    const documentFile = new Document({
        sections: [{
            properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
            children,
        }],
    });
    downloadBlob(await Packer.toBlob(documentFile), `${currentBaseName}.docx`);
    setStatus('Archivo Word generado.', 'success');
}

function downloadPdf() {
    const jsPDF = window.jspdf?.jsPDF;
    if (!jsPDF) {
        setStatus('No se pudo cargar el exportador de PDF. Revisa tu conexión a Internet.', 'error');
        return;
    }

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const margin = 54;
    const lineHeight = 12;
    const maxY = pdf.internal.pageSize.getHeight() - margin;
    let y = margin;
    pdf.setFont('courier', 'normal');
    pdf.setFontSize(9.5);

    for (const line of currentResult.split('\n')) {
        if (y > maxY) {
            pdf.addPage();
            pdf.setFont('courier', 'normal');
            pdf.setFontSize(9.5);
            y = margin;
        }
        pdf.text(line || ' ', margin, y);
        y += lineHeight;
    }
    pdf.save(`${currentBaseName}.pdf`);
    setStatus('Archivo PDF generado.', 'success');
}

elements.fileInput.addEventListener('change', () => handleFile(elements.fileInput.files[0]));
elements.dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        elements.fileInput.click();
    }
});
['dragenter', 'dragover'].forEach((eventName) => elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.add('is-dragging');
}));
['dragleave', 'drop'].forEach((eventName) => elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove('is-dragging');
}));
elements.dropZone.addEventListener('drop', (event) => handleFile(event.dataTransfer.files[0]));
elements.justify.addEventListener('click', () => runJustifier());
elements.source.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') runJustifier();
});
elements.clear.addEventListener('click', () => {
    elements.source.value = '';
    elements.fileInput.value = '';
    elements.fileInfo.hidden = true;
    elements.result.textContent = 'El resultado aparecerá aquí.';
    document.querySelector('#result-panel').classList.remove('is-visible');
    elements.stats.textContent = 'Sin procesar';
    currentResult = '';
    currentBaseName = 'texto_justificado';
    setExportState(false);
    setStatus('');
    elements.source.focus();
});
elements.removeFile.addEventListener('click', () => {
    elements.fileInput.value = '';
    elements.fileInfo.hidden = true;
    currentBaseName = 'texto_justificado';
    setStatus('Archivo quitado. El texto extraído permanece disponible.');
});
elements.copy.addEventListener('click', copyResult);
elements.txt.addEventListener('click', () => {
    downloadBlob(new Blob([currentResult], { type: 'text/plain;charset=utf-8' }), `${currentBaseName}.txt`);
    setStatus('Archivo TXT generado.', 'success');
});
elements.docx.addEventListener('click', downloadDocx);
elements.pdf.addEventListener('click', downloadPdf);
