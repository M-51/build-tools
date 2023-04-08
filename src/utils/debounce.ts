type Types = Set<string>;
type Added = Array<string>;
type Changed = Array<string>;

type Callback = (added?: string, changed?: string, types?: Types) => unknown;

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

function debounce(callback: Callback, time = 50) {
    let interval: NodeJS.Timeout;
    const added: Added = [];
    const changed: Changed = [];
    const types: Types = new Set();
    return (event: 'added' | 'changed', filePath: string, type: string) => {
        if (type) types.add(type);
        clearTimeout(interval);
        if (event === 'added') added.push(filePath);
        if (event === 'changed') changed.push(filePath);
        interval = setTimeout(() => {
            callback(formatListOfFilesMessage(added), formatListOfFilesMessage(changed), types);
            added.length = 0;
            changed.length = 0;
            types.clear();
        }, time);
    };
}

export default debounce;
export { Callback };
