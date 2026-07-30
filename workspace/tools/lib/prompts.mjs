import readline from "node:readline";
import { color } from "./terminal.mjs";

export async function chooseOne(message, choices, options = {}) {
  const initialIndex = Math.max(
    0,
    choices.findIndex((choice) => choice.value === options.initialValue)
  );

  return promptChoices({
    choices,
    initialIndex,
    message,
    multiple: false
  });
}

export async function chooseMany(message, choices, options = {}) {
  const initialValues = new Set(options.initialValues ?? []);
  const initialIndexes = choices
    .map((choice, index) => (initialValues.has(choice.value) ? index : -1))
    .filter((index) => index >= 0);

  return promptChoices({
    choices,
    initialIndexes,
    message,
    multiple: true
  });
}

function promptChoices({ choices, initialIndex = 0, initialIndexes = [], message, multiple }) {
  if (choices.length === 0) {
    throw new Error(`${message} has no choices.`);
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Interactive selection requires a terminal.");
  }

  return new Promise((resolve, reject) => {
    const input = process.stdin;
    const output = process.stdout;
    const wasRaw = input.isRaw;
    const selected = new Set(initialIndexes);
    let cursor = Math.min(initialIndex, choices.length - 1);
    let renderedLines = 0;
    let notice = "";

    const cleanup = () => {
      input.off("keypress", onKeypress);
      input.setRawMode(wasRaw);
      input.pause();
      output.write("\n");
    };

    const finish = (value) => {
      cleanup();
      resolve(value);
    };

    const fail = (error) => {
      cleanup();
      reject(error);
    };

    const render = () => {
      const lines = [
        color.bold(message),
        color.dim(multiple
          ? "Up/Down moves, Space toggles, A toggles all, Enter confirms, Ctrl-C cancels."
          : "Up/Down moves, Enter confirms, Ctrl-C cancels."),
        color.dim(multiple ? `${selected.size}/${choices.length} selected` : `choice ${cursor + 1} of ${choices.length}`)
      ];

      for (const [index, choice] of choices.entries()) {
        const pointer = index === cursor ? ">" : " ";
        const marker = multiple
          ? selected.has(index) ? "[x]" : "[ ]"
          : index === cursor ? "(*)" : "( )";
        const detail = choice.detail ? ` ${color.dim(choice.detail)}` : "";
        lines.push(`${pointer} ${marker} ${choice.label}${detail}`);
      }

      if (notice) {
        lines.push(color.yellow(notice));
      }

      if (renderedLines > 0) {
        output.write(`\x1b[${renderedLines}A`);
      }

      for (const line of lines) {
        output.write(`\x1b[2K\r${line}\n`);
      }

      renderedLines = lines.length;
    };

    const move = (offset) => {
      cursor = (cursor + offset + choices.length) % choices.length;
      notice = "";
      render();
    };

    const toggleCurrent = () => {
      if (selected.has(cursor)) {
        selected.delete(cursor);
      } else {
        selected.add(cursor);
      }

      notice = "";
      render();
    };

    const toggleAll = () => {
      if (selected.size === choices.length) {
        selected.clear();
      } else {
        for (const index of choices.keys()) {
          selected.add(index);
        }
      }

      notice = "";
      render();
    };

    function onKeypress(_value, key) {
      if (key.ctrl && key.name === "c") {
        fail(new Error("Interactive selection cancelled."));
      } else if (key.name === "up") {
        move(-1);
      } else if (key.name === "down") {
        move(1);
      } else if (multiple && key.name === "space") {
        toggleCurrent();
      } else if (multiple && key.name === "a") {
        toggleAll();
      } else if (key.name === "return" || key.name === "enter") {
        if (multiple) {
          if (selected.size === 0) {
            notice = "Select at least one project.";
            render();
            return;
          }

          finish([...selected].sort((left, right) => left - right).map((index) => choices[index].value));
        } else {
          finish(choices[cursor].value);
        }
      }
    }

    readline.emitKeypressEvents(input);
    input.setRawMode(true);
    input.resume();
    input.on("keypress", onKeypress);
    render();
  });
}
