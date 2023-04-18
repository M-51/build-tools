function progressBar(total: number, length = 20) {
    let currentStep: number = 0;
    return (step?: number, err: boolean = false) => {
        if (step !== undefined) currentStep = step;
        const clampedStep = Math.min(Math.max(currentStep, 0), total);
        const percentage = Math.ceil((clampedStep * 100) / total);
        const bars = Math.ceil(percentage / (100 / length));
        if (err) return `\x1b[31m${'\u2588'.repeat(bars)}${'\u2591'.repeat(length - bars)}\x1b[0m ${String(percentage).padStart(3)}% | \x1b[36m${clampedStep}/${total}\x1b[0m | `;
        return `${'\u2588'.repeat(bars)}${'\u2591'.repeat(length - bars)} ${String(percentage).padStart(3)}% | \x1b[36m${clampedStep}/${total}\x1b[0m | `;
    };
}

export default progressBar;
