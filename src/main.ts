import chokidar from 'chokidar';
import http from 'http';

import debounce from './utils/debounce.js';
import log from './utils/logger.js';

import type { Callback } from './utils/debounce.js';

const refresh: Callback = (added, changed, types) => {
    console.log(added);
    console.log(changed);
    console.log(types);
};

const debouncedRefresh = debounce(refresh);

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
    /*
    const params = parseArgs({
        options: {
            browsers: { type: 'string', short: 'b', multiple: true },
        },
        strict: true,
    });
    */

    const closeServer = (() => {
        if (config.server) {
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
