export function downloadTextFile(filename, textContent) {
  const blob = new Blob([String(textContent ?? "")], {
    type: "text/plain;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export async function pickTextFile(accept = ".tsv,.csv,.txt,text/plain") {
  if (typeof window.showOpenFilePicker === "function") {
    try {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: "Table/Text files",
            accept: {
              "text/plain": [".tsv", ".csv", ".txt"],
            },
          },
        ],
      });

      if (!handle) {
        return null;
      }

      const file = await handle.getFile();
      return await file.text();
    } catch (error) {
      if (error && typeof error === "object" && "name" in error && error.name === "AbortError") {
        return null;
      }
      throw error;
    }
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    let settled = false;
    let watchdogId = 0;

    const finalizeResolve = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(value);
    };

    const finalizeReject = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      if (input.parentNode) {
        input.parentNode.removeChild(input);
      }
      if (watchdogId) {
        window.clearTimeout(watchdogId);
        watchdogId = 0;
      }
      input.removeEventListener("cancel", onCancel);
    };

    const onCancel = () => {
      if (settled) {
        return;
      }
      finalizeResolve(null);
    };

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) {
        finalizeResolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        finalizeResolve(String(reader.result ?? ""));
      };
      reader.onerror = () => {
        finalizeReject(new Error("Errore lettura file."));
      };
      reader.readAsText(file);
    });

    input.addEventListener("cancel", onCancel);
    document.body.appendChild(input);
    input.click();

    // Fallback for browsers without `cancel` event support.
    watchdogId = window.setTimeout(() => {
      if (settled) {
        return;
      }
      finalizeResolve(null);
    }, 120000);
  });
}
