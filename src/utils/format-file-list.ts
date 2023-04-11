import type { Callback } from './debounce.js';

function formatFileList(added: Parameters<Callback>[0], changed: Parameters<Callback>[1]) {
    const message = (() => {
        if (added && changed) return `${added} added; ${changed} changed`;
        if (added) return `${added} added`;
        if (changed) return `${changed} changed`;
        return '';
    })();
    return message;
}

export default formatFileList;
