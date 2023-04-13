import chokidar from 'chokidar';
import http from 'http';
import { parseArgs } from 'node:util';
import debounce from './utils/debounce.js';
import log from './utils/logger.js';

import type { Callback } from './utils/debounce.js';
// import progressBar from './utils/progressbar.js';
import placeholder from './utils/placeholder.js';
import formatLogLine from './utils/format-log-line.js';
import type { Status } from './utils/format-log-line.js';

interface Config {
    watchers: {
        [key: string]: {
            compile: () => Promise<unknown>,
            glob: string | Array<string>,
        }
    }
    server?: {
        listener: http.RequestListener,
        port?: number,
    }
}

async function main(config: Config) {
    const params = parseArgs({
        options: {
            browsers: { type: 'string', short: 'b', multiple: true },
            server: { type: 'boolean', short: 's' },
        },
        strict: true,
    });
    const { addPlaceholder, deletePlaceholder } = placeholder('Waiting for change...');

    const refresh: Callback = async (added, changed, types) => {
        deletePlaceholder();
        const now = Date.now();
        const usedTypes = Object.keys(config.watchers).filter((type) => types.includes(type));
        const status: Status = new Map(usedTypes.map((type) => [type, { status: 'compiling', startTime: now }]));
        const updateLogLine = formatLogLine(added, changed, status);

        try {
            await Promise.all(usedTypes.map((type) => (async () => {
                const obj = status.get(type);
                try {
                    await config.watchers[type].compile();
                    obj.status = 'compiled';
                    obj.finishTime = Date.now();
                    updateLogLine(status);
                } catch (error) {
                    obj.status = 'error';
                    updateLogLine(status);
                    throw error;
                }
            })()));
        } catch (error) {
            console.error(error);
            addPlaceholder();
            return;
        }
        addPlaceholder();
    };

    const debouncedRefresh = debounce(refresh);
    const closeServer = (() => {
        if (params.values.server && config.server?.listener) {
            const server = http.createServer(config.server.listener).listen(config.server.port || 8080);
            return () => new Promise((resolve, reject) => {
                server.close((err) => {
                    if (err) return reject(err);
                    return resolve(true);
                });
            });
        }
        return undefined;
    })();

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

export default main;
