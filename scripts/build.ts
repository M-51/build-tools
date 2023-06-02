import { build } from '../src/index.js';

function sleep(time: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, time);
    });
}

build([
    { name: 'first task', task: async () => { await sleep(1000); } },
    [
        { name: 'second task', task: async () => { await sleep(1000); } },
        { name: 'third task', task: async () => { await sleep(1000); } },
    ],
    { name: 'fourth task', task: async () => { await sleep(1000); } },
    { name: 'fourth task', task: async () => { await sleep(1000); } },
    { name: 'fifth task', task: async () => { await sleep(1000); } },
]);
