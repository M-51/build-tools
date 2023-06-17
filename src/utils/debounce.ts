type Types = Array<string>;
type Added = Array<string>;
type Changed = Array<string>;

type Callback = (added?: Added, changed?: Changed, types?: Types) => unknown;

function debounce(callback: Callback, time = 50) {
    let interval: NodeJS.Timeout;
    const added: Added = [];
    const changed: Changed = [];
    const types: Types = [];
    return (event: 'added' | 'changed', filePath: string, type: string) => {
        if (type) types.push(type);
        clearTimeout(interval);
        if (event === 'added') added.push(filePath);
        if (event === 'changed') changed.push(filePath);
        interval = setTimeout(() => {
            callback(added, changed, types);
            added.length = 0;
            changed.length = 0;
            types.length = 0;
        }, time);
    };
}

export { debounce };
export type { Callback, Added, Changed };
