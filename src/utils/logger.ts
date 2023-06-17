const queue: Array<{ now: number, dateString: string }> = [];

function log(message: string) {
    const now = Date.now();
    const obj = { now, dateString: (new Date(now)).toLocaleString('pl-PL') };
    if (process.stdout.isTTY) {
        queue.push(obj);
        process.stdout.cursorTo(0);
        process.stdout.clearLine(0);
        process.stdout.write(`\x1b[36m${obj.dateString}\x1b[0m | ${message}\n`);
        return (msg: string) => {
            const offset = queue.length - queue.indexOf(obj);
            process.stdout.moveCursor(0, offset * (-1));
            process.stdout.cursorTo(0);
            process.stdout.clearLine(0);
            process.stdout.write(`\x1b[36m${obj.dateString}\x1b[0m | ${msg.replaceAll('{time}', String(Date.now() - obj.now))}\n`);
            process.stdout.moveCursor(0, offset - 1);
            process.stdout.cursorTo(0);
        };
    }
    console.log(`\x1b[36m${obj.dateString}\x1b[0m | ${message}\n`);
    return (msg: string) => {
        console.log(`\x1b[36m${obj.dateString}\x1b[0m | ${msg.replaceAll('{time}', String(Date.now() - obj.now))}\n`);
    };
}

export { log };
