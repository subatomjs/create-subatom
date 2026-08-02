// Ensure 'console' is available in environments where the default lib
// doesn't include the DOM/Console definitions.
declare const console: { log(...args: any[]): void };

function main() {
  console.log("Hello world");
}

main();
