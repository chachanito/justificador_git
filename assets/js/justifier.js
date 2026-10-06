export const DEFAULT_WIDTH = 75;
export const MIN_WIDTH = 30;
export const MAX_WIDTH = 140;

const BULLET_PATTERN = /^(?:(\d{1,3}|[A-Za-z])[.)]|[•●▪◦‣➢►*+>º-]|o)\s+/u;

export function normalizeTypography(value) {
    return String(value ?? '')
        .replace(/\r\n?/g, '\n')
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/\u2026/g, '...')
        .replace(/\u00A0/g, ' ');
}

export function clampWidth(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return DEFAULT_WIDTH;
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, parsed));
}

function splitPrefix(line) {
    const match = line.match(BULLET_PATTERN);
    if (!match) return { prefix: '', content: line };

    const prefix = match[0].trimEnd() + ' ';
    return { prefix, content: line.slice(match[0].length).trim() };
}

function spreadWords(words, targetWidth) {
    if (words.length < 2) return words.join(' ');

    const letters = words.reduce((total, word) => total + [...word].length, 0);
    const gaps = words.length - 1;
    const spaces = Math.max(gaps, targetWidth - letters);
    const base = Math.floor(spaces / gaps);
    const remainder = spaces % gaps;

    return words.map((word, index) => {
        if (index === words.length - 1) return word;
        return word + ' '.repeat(base + (index < remainder ? 1 : 0));
    }).join('');
}

function splitLongWord(word, width) {
    const characters = [...word];
    const pieces = [];
    for (let index = 0; index < characters.length; index += width) {
        pieces.push(characters.slice(index, index + width).join(''));
    }
    return pieces;
}

function formatParagraph(rawLine, width) {
    const cleanLine = rawLine.trim();
    if (!cleanLine) return [''];

    const { prefix, content } = splitPrefix(cleanLine);
    if (!content) return [prefix.trimEnd()];

    const indent = ' '.repeat([...prefix].length);
    const lines = [];
    let words = [];
    let wordLength = 0;
    let firstLine = true;

    const flush = (isLast = false) => {
        if (!words.length) return;
        const start = firstLine ? prefix : indent;
        const available = Math.max(1, width - [...start].length);
        const body = isLast ? words.join(' ') : spreadWords(words, available);
        lines.push(start + body);
        words = [];
        wordLength = 0;
        firstLine = false;
    };

    for (const originalWord of content.split(/\s+/u)) {
        let pieces = [originalWord];
        const currentStart = firstLine ? prefix : indent;
        const currentAvailable = Math.max(1, width - [...currentStart].length);
        if ([...originalWord].length > currentAvailable) {
            pieces = splitLongWord(originalWord, currentAvailable);
        }

        for (const piece of pieces) {
            const start = firstLine ? prefix : indent;
            const available = Math.max(1, width - [...start].length);
            const pieceLength = [...piece].length;
            const projected = wordLength + pieceLength + words.length;

            if (words.length && projected > available) flush(false);

            words.push(piece);
            wordLength += pieceLength;

            if (pieceLength >= available) flush(false);
        }
    }

    flush(true);
    return lines;
}

export function justifyText(value, requestedWidth = DEFAULT_WIDTH) {
    const width = clampWidth(requestedWidth);
    const normalized = normalizeTypography(value);
    return normalized.split('\n').flatMap((line) => formatParagraph(line, width)).join('\n');
}

export function textStats(value) {
    const lines = String(value ?? '').split('\n');
    return {
        characters: [...String(value ?? '')].length,
        lines: lines.length,
        longestLine: Math.max(0, ...lines.map((line) => [...line].length)),
    };
}
