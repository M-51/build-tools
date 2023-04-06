import chokidar from 'chokidar';
import { parseArgs } from 'node:util';

import debounce from './utils/debounce.js';
import log from './utils/logger.js';

async function dev() {
    const closeServer = config.server();

    const watchers = Object.entries(config.watchers).map(([name, value]) => {
        const watcher = chokidar.watch(value.glob)
            .on('change', (filePath) => { debouncedRefresh('changed', filePath, name); })
            .on('add', (filePath) => { debouncedRefresh('added', filePath, name); });
        return watcher;
    });

    const shutdownPromises = [async () => { const logger = log('Closing watchers...'); await Promise.all(watchers.map((watcher) => watcher.close())); logger('Watchers closed in {time}ms'); }];

    if (closeServer) shutdownPromises.push(async () => { const logger = log('Closing server...'); await closeServer(); logger('Server closed in {time}ms'); });

    process.on('SIGINT', debounce(() => Promise.all(shutdownPromises.map((promise) => promise()))));
}

function main() {
    const params = parseArgs({
        options: {
            browsers: { type: 'string', short: 'b', multiple: true },
        },
        strict: true,
    });

    dev();
}
main();