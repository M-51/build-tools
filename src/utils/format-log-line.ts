import type { Callback } from './debounce.js';
import log from './logger.js';

type Status = Map<string, { status: 'compiled' | 'compiling' | 'error', finishTime?: number, startTime: number }>;

function formatFileList(added: Parameters<Callback>[0], changed: Parameters<Callback>[1]) {
    const message = (() => {
        if (added && changed) return `${added} added; ${changed} changed`;
        if (added) return `${added} added`;
        if (changed) return `${changed} changed`;
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
    return (updates: Status) => {
        logger(`${formatedFileList} | ${formatStatus(updates)}`);
    };
}
export default formatLogLine;
export type { Status };
