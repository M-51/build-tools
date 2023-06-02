import log from './utils/logger.js';
import placeholder from './utils/placeholder.js';
import progressBar from './utils/progressbar.js';

type Results = Map<string, unknown>;
type Task = { name: string, task: (results: Results) => Promise<unknown> };
type Tasks = Array<Task | Array<Task>>;

let finished = 0;

async function runTask({ name, task }: Task, results: Results, taskPlaceholder: ReturnType<typeof placeholder>, bar: ReturnType<typeof progressBar>) {
    const { addPlaceholder, deletePlaceholder } = taskPlaceholder;
    deletePlaceholder();
    const logger = log(`\x1b[30m${name} ⌛\x1b[0m`);
    addPlaceholder(bar(finished));
    try {
        const out = await task(results);
        if (out !== undefined) results.set(name, out);
        deletePlaceholder();
        finished += 1;
        logger(`\x1b[32m${name} ✓ - {time}ms\x1b[0m`);
        addPlaceholder(bar(finished));
    } catch (error) {
        deletePlaceholder();
        logger(`\x1b[31m${name} ✖\x1b[0m`);
        addPlaceholder(bar(finished, true));
        throw error;
    }
}

async function build(tasks: Tasks) {
    finished = 0;
    const now = Date.now();
    const bar = progressBar(tasks.flat().length);
    const taskPlaceholder = placeholder(bar(finished));
    const results = new Map();
    for (const task of tasks) {
        if (Array.isArray(task)) {
            await Promise.all(task.map((subTask) => runTask(subTask, results, taskPlaceholder, bar)));
        } else {
            await runTask(task, results, taskPlaceholder, bar);
        }
    }
    taskPlaceholder.deletePlaceholder();
    taskPlaceholder.addPlaceholder(`${bar(finished)} | \x1b[32mAll tasks finished successfuly in ${Math.round((Date.now() - now) / 10) / 100}s ✓\x1b[0m`);
}

export default build;
