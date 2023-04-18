import type { Callback, Added, Changed } from './debounce.js';
import log from './logger.js';

type Status = Map<string, { status: 'compiled' | 'compiling' | 'error', finishTime?: number, startTime: number }>;

function formatListOfFilesMessage(arr: Added | Changed) {
    const message = `${arr.slice(0, 3).map((p) => {
        const chunks = p.split('/');
        const indexOfRoot = chunks.indexOf('src');
        if (indexOfRoot === -1) return chunks.slice(chunks.length - 3).join('/');
        return chunks.slice(indexOfRoot + 1).join('/');
    })
        .map((chunk) => `\x1b[34m${chunk}\x1b[0m`)
        .join(', ')}${arr.length > 3 ? ` and ${arr.length - 3} ${arr.length - 3 === 1 ? 'more file' : 'other files'}` : ''}`;
    return message;
}

function formatFileList(added: Parameters<Callback>[0], changed: Parameters<Callback>[1]) {
    const formated = {
        added: formatListOfFilesMessage(added),
        changed: formatListOfFilesMessage(changed),
    };
    const message = (() => {
        if (formated.added && formated.changed) return `${formated.added} added; ${formated.changed} changed`;
        if (formated.added) return `${formated.added} added`;
        if (formated.changed) return `${formated.changed} changed`;
        return '';
    })();
    return message;
}

function formatStatus(status: Status) {
    return [...status].map(([key, value]) => {
        if (value.status === 'compiled') return `\x1b[32m${key} ✓ - ${value.finishTime - value.startTime}ms\x1b[0m`;
        if (value.status === 'error') return `\x1b[31m${key} ✖\x1b[0m`;
        return `\x1b[30m${key} ⌛\x1b[0m`;
    }).join(' | ');
}

function formatLogLine(added: Parameters<Callback>[0], changed: Parameters<Callback>[1], status: Status) {
    const formatedFileList = formatFileList(added, changed);
    const logger = log(`${formatedFileList} | ${formatStatus(status)}`);
    return (updates: Status, extra?: string) => {
        logger(`${formatedFileList} | ${formatStatus(updates)}${extra || ''}`);
    };
}
export default formatLogLine;
export type { Status };
