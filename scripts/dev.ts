/* eslint-disable @typescript-eslint/naming-convention */
import esbuild from 'esbuild';
import path from 'path';
import { readFile } from 'node:fs/promises';
import { bundleAsync } from 'lightningcss';

import { dev } from '../src/index.ts';

const rootDir = path.join(new URL(import.meta.url).pathname, '../../');

const paths = {
    htmlFile: path.join(rootDir, './scripts/content/index.html'),
    cssFile: path.join(rootDir, './scripts/content/style.css'),
    tsFile: path.join(rootDir, './scripts/content/scripts.ts'),
};

const cache: Map<string, string> = new Map();

dev({
    watchers: {
        CSS: {
            compile: async () => {
                const { code } = await bundleAsync({
                    filename: paths.cssFile,
                    minify: true,
                    drafts: {
                        customMedia: true,
                    },
                });
                const css = String(code);
                cache.set('css', css);
                return css;
            },
            glob: path.join(rootDir, './scripts/content/style.css'),
        },
        HTML: {
            compile: async () => {
                const html = await readFile(paths.htmlFile, { encoding: 'utf-8' });
                cache.set('html', html);
                return html;
            },
            glob: path.join(rootDir, './scripts/content/index.html'),
        },
        Typescript: {
            compile: async () => {
                const build = await esbuild.build({
                    entryPoints: [paths.tsFile],
                    write: false,
                    bundle: true,
                    format: 'esm',
                    logLevel: 'silent',
                    sourcemap: 'inline',
                    target: 'es2020',
                });
                if (typeof build.outputFiles[0]?.text !== 'string') {
                    throw new Error('Cannot find output file');
                }
                const js = build.outputFiles[0].text;
                cache.set('js', js);
                return js;
            },
            glob: [path.join(rootDir, './scripts/content/scripts.ts'), path.join(rootDir, './src')],
        },
    },
    server: {
        listener: async (req, res) => {
            if (req.url === '/') {
                const file = cache.get('html');
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(file);
                return;
            }
            if (req.url === '/style.css') {
                const file = cache.get('css');
                res.writeHead(200, { 'Content-Type': 'text/css' });
                res.end(file);
                return;
            }
            if (req.url === '/script.js') {
                const file = cache.get('js');
                res.writeHead(200, { 'Content-Type': 'application/javascript' });
                res.end(file);
                return;
            }
            if (req.url?.startsWith('/audio/') === true) {
                try {
                    const filename = req.url.split('/').at(-1);
                    const buffer = await readFile(path.join(rootDir, `./audio/${filename}`));
                    res.writeHead(200, { 'Content-Type': 'audio/x-matroska' });
                    res.end(buffer);
                    return;
                } catch (error: unknown) {
                    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return;
                    throw error;
                }
            }
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404');
        },
        port: 8080,
    },
    browsers: {
        viewport: {
            width: 1700,
            height: 900,
        },
    },
}).catch((error: unknown) => {
    throw error;
});
