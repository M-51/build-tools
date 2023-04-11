import chokidar from 'chokidar';
import http from 'http';

import debounce from './utils/debounce.js';
import log from './utils/logger.js';

import type { Callback } from './utils/debounce.js';
import progressBar from './utils/progressbar.js';
import placeholder from './utils/placeholder.js';
import formatFileList from './utils/format-file-list.js';


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
/*
function formatLogLine(status: { [key: string]: 'compiling' | 'compiled' | 'error' }) {
    return Object.entries(status).map(([type, value]) => `${type} ${value}`).join(' | ');
}
*/

function formatLogLine(added: Parameters<Callback>[0], changed: Parameters<Callback>[1], usedTypes: Parameters<Callback>[2]) {
    const status = Object.fromEntries(usedTypes.map((key) => [key, 'compiling']));
    const formatedFileList = formatFileList(added, changed);
    const logger = log(`${formatedFileList} | `);
    return (updates: typeof status) => {
        
        logger(`${formatedFileList} | ${formatLogLine(status)}`);
    }
    // return Object.entries(status).map(([type, value]) => `${type} ${value}`).join(' | ');


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
    const { addPlaceholder, deletePlaceholder } = placeholder('Waiting for change...');

    const refresh: Callback = async (added, changed, types) => {
        deletePlaceholder();

        const usedTypes = Object.keys(config.watchers).filter((type) => types.includes(type));
        // const status: Parameters<typeof formatLogLine>[0] = Object.fromEntries(usedTypes.map((key) => [key, 'compiling']));

        
        try {
            await Promise.all(usedTypes.map((type) => (async () => {
                try {
                    await config.watchers[type].compile();
                    status[type] = 'compiled';
                    
                } catch (error) {
                    status[type] = 'error';
                    throw error;
                }
            })()));
        } catch (error) {
            logger(`${formatedFileList} | ${formatLogLine(status)}`);
            console.error(error);
            addPlaceholder();
            return;
        }
        logger(`${formatedFileList} | ${formatLogLine(status)}`);
        addPlaceholder();
    };

    const debouncedRefresh = debounce(refresh);

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
