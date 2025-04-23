import chokidar from 'chokidar';
import http from 'http';
import { parseArgs } from 'node:util';
import playwright from 'playwright';
import { debounce } from './utils/debounce.js';
import { log } from './utils/logger.js';
import { capitalize } from './utils/captilalize.js';
import type { Callback } from './utils/debounce.js';
import { progressBar } from './utils/progressbar.js';
import { placeholder } from './utils/placeholder.js';
import { formatLogLine } from './utils/format-log-line.js';
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
    browsers?: {
        viewport?: {
            width: number,
            height: number,
        }
    }
}

async function dev(config: Config) {
    const params = parseArgs({
        options: {
            browsers: { type: 'string', short: 'b', multiple: true },
            server: { type: 'boolean', short: 's' },
            url: { type: 'string', short: 'u' },
            watch: { type: 'boolean', short: 'w' },
        },
        strict: false,
    });
    const { addPlaceholder, deletePlaceholder } = placeholder('Waiting for change...');
    const port = config.server?.port || 8080;

    const closeServer = await (async () => {
        if (params.values.server && config.server?.listener) {
            const bar = progressBar(1);
            const logger = log(`${bar()} | Starting server...`);
            const server = http.createServer(config.server.listener).listen(port, () => logger(`${bar(1)} | Server started in {time}ms. Listening on \x1b[35mhttp://localhost:${port}\x1b[0m`));
            return () => new Promise((resolve, reject) => {
                server.close((err) => {
                    if (err) return reject(err);
                    return resolve(true);
                });
            });
        }
        return undefined;
    })();

    const browsers = await (async () => {
        const availableBrowsers: Array<'firefox' | 'chromium' | 'webkit'> = ['firefox', 'chromium', 'webkit'];
        const browsersToStart = availableBrowsers.filter((browser) => params.values.browsers?.includes(browser));
        const data = await Promise.all(browsersToStart.map(async (browserName) => {
            const bar = progressBar(4);
            const logger = log(`${bar()} | ${capitalize(browserName)} => Starting browser...`);
            let state = 'Creating browser context...';
            try {
                const browser = await playwright[browserName].launch({ headless: false, handleSIGINT: false, devtools: true });
                logger(`${bar(1)} | ${capitalize(browserName)} => ${state}`);
                const context = await browser.newContext({ viewport: config.browsers?.viewport || { width: 1500, height: 900 } });
                state = 'Opening new page...';
                logger(`${bar(2)} | ${capitalize(browserName)} => ${state}`);
                const page = await browser.contexts()[0].newPage();
                const url = params.values.url || `http://localhost${params.values.server && config.server?.listener ? `:${port}` : ''}`;
                state = `Navigating to ${url}...`;
                logger(`${bar(3)} | ${capitalize(browserName)} => ${state}`);
                await page.goto(url);
                state = 'Ready';
                logger(`${bar(4)} | ${capitalize(browserName)} => \x1b[32m${state} ✓\x1b[0m`);
                return { page, browser, context };
            } catch (err) {
                logger(`${bar(undefined, true)} ${capitalize(browserName)} => ${state} | \x1b[31mFailed to launch browser ✖\x1b[0m`);
                throw err;
            }
        }));
        return data;
    })();

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

        if (browsers.length > 0) {
            try {
                const pages = browsers.map((browserData) => browserData.page);
                await Promise.all(pages.map(async (page) => {
                    await page.reload();
                }));
            } catch (error) {
                console.error(error);
                addPlaceholder();
                return;
            }
        }
        addPlaceholder();
    };

    const shutdownPromises: Array<() => Promise<void>> = [];

    if (params.values.watch) {
        const debouncedRefresh = debounce(refresh);
        const watchers = Object.entries(config.watchers).map(([name, value]) => {
            const watcher = chokidar.watch(value.glob)
                .on('change', (filePath) => { debouncedRefresh('changed', filePath, name); })
                .on('add', (filePath) => { debouncedRefresh('added', filePath, name); });
            return watcher;
        });
        shutdownPromises.push(async () => { const logger = log('Closing watchers...'); await Promise.all(watchers.map((watcher) => watcher.close())); logger('Watchers closed in {time}ms'); });
    } else {
        await refresh([], [], Object.keys(config.watchers));
        deletePlaceholder();
    }

    if (closeServer) shutdownPromises.push(async () => { const logger = log('Closing server...'); await closeServer(); logger('Server closed in {time}ms'); });

    for (const { browser } of browsers) {
        shutdownPromises.push(async () => {
            const name = browser.browserType().name();
            const logger = log(`Closing ${name} contexts...`);
            await Promise.all(browser.contexts().map(async (context) => { await context.close(); }));
            logger(`Closing ${name}...`);
            await browser.close();
            logger(`${capitalize(name)} closed in {time}ms`);
        });
    }

    process.on('SIGINT', debounce(() => Promise.all(shutdownPromises.map((promise) => promise()))));
}

export { dev };
