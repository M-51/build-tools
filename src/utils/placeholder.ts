function placeholder(msg: string) {
    let isActive = false;
    return {
        addPlaceholder: () => {
            if (process.stdout.isTTY) process.stdout.write(`${msg}\n`);
            isActive = true;
        },
        deletePlaceholder: () => {
            if (isActive && process.stdout.isTTY) {
                process.stdout.moveCursor(0, -1);
                process.stdout.cursorTo(0);
                process.stdout.clearLine(0);
                isActive = false;
            }
        },
    };
}

export default placeholder;
