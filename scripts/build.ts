import { build } from '../src/index.ts';

async function sleep(time: number) : Promise<void> {
    await new Promise((resolve) => {
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
]).catch((error: unknown) => {
    console.error(error);
});
