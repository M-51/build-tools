function progressBar(total: number, length = 20) {
    return (step: number) => {
        const clampedStep = Math.min(Math.max(step, 0), total);
        const percentage = Math.ceil((clampedStep * 100) / total);
        const bars = Math.ceil(percentage / (100 / length));
        return `${'\u2588'.repeat(bars)}${'\u2591'.repeat(length - bars)} ${String(percentage).padStart(3)}% | \x1b[36m${clampedStep}/${total}\x1b[0m | `;
    };
}

export default progressBar;
