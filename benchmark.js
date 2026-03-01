import { performance } from 'perf_hooks';
import { get } from 'svelte/store';
import { init, addDictionary, registerLoader, setLocale, t, locale } from './index.js';

function runBenchmark(name, fn, iterations = 10000) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        fn();
    }
    const end = performance.now();
    const duration = end - start;
    console.log(`[${name.padEnd(25)}] ${iterations.toLocaleString()} ops: ${duration.toFixed(2).padStart(8)}ms (${(iterations / (duration / 1000)).toLocaleString(undefined, { maximumFractionDigits: 0 }).padStart(10)} ops/sec)`);
}

async function runSuite() {
    console.log("=== Svelte Whisper Benchmark Suite ===\n");

    // Setup
    init({ fallback: 'en', initial: 'en' });
    addDictionary('en', {
        hello: 'Hello',
        deeply: { nested: { key: "Success!" } },
        interp: "Hello {user}, you have {0} messages."
    });

    const storeValue = get(t);

    console.log("--- Read Performance ---");
    runBenchmark("Static Flat Key", () => storeValue('hello'), 1_000_000);
    runBenchmark("Missing Key (Fallback)", () => storeValue('missing.key'), 1_000_000);
    runBenchmark("Deep Nested Key", () => storeValue('deeply.nested.key'), 1_000_000);

    console.log("\n--- Interpolation Performance ---");
    runBenchmark("Static String (No vars)", () => storeValue('hello', { unused: true }), 1_000_000);
    runBenchmark("Mixed Interpolation", () => storeValue('interp', ['5'], { user: 'Alice' }), 1_000_000);

    console.log("\n--- Lazy Loading Performance (20+ Languages) ---");

    // Register 25 lazy languages
    for (let i = 0; i < 25; i++) {
        registerLoader(`lang_${i}`, async () => {
            return { default: { greeting: `Hello from lang ${i}` } };
        });
    }

    const loadStart = performance.now();
    for (let i = 0; i < 25; i++) {
        await setLocale(`lang_${i}`);
        storeValue('greeting'); // trigger read
    }
    const loadEnd = performance.now();

    console.log(`Loaded and mounted 25 dynamic languages in ${(loadEnd - loadStart).toFixed(2)}ms`);
    console.log(`Store value verification at end: ${storeValue('greeting')}`);

    console.log("\n--- Store Change Reactions ---");
    let subscriptionFires = 0;
    const unsub = t.subscribe(() => { subscriptionFires++; });

    // Subscription fires immediately once on init
    subscriptionFires = 0;

    const reactionStart = performance.now();
    // Simulate changing locales 1000 times between 2 loaded languages
    for (let i = 0; i < 1000; i++) {
        await setLocale(i % 2 === 0 ? 'en' : 'lang_0');
    }
    const reactionEnd = performance.now();

    unsub();
    console.log(`1000 Locale changes/re-renders fired in ${(reactionEnd - reactionStart).toFixed(2)}ms`);
    console.log(`Derived $t computed ${subscriptionFires} times`);

    console.log("\n=======================================\n");
}

runSuite().catch(console.error);
