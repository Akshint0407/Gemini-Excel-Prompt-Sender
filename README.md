# Gemini Excel Prompt Sender

A Chrome extension (Manifest V3) that reads prompts from an Excel file and sends them one by one to [Gemini](https://gemini.google.com/), waiting for each generated image to finish before moving on to the next prompt.

> **Disclaimer:** This is an unofficial tool and is not affiliated with or endorsed by Google. It automates the Gemini web interface, so make sure your use complies with Gemini's terms of service.

---

## Features

- Upload an `.xlsx` file from the extension popup; prompts are read from it automatically.
- Sends prompts to Gemini sequentially, one at a time.
- Waits until Gemini has actually finished rendering the image for the current prompt before loading the next one, then waits 2 seconds between prompts.
- Optional **From / To** range: send only the prompts whose **Prompt Number** falls within a range (inclusive). Leave the fields blank to send everything.
- Each prompt's **Negative Prompt** (if present) is appended directly after the main prompt in the same message.
- Live progress box shown directly on the Gemini page (e.g. `Sent 12/41`), with a final confirmation such as `All 41/41 prompts sent successfully.`
- Works on a Gemini tab that was already open before the extension was installed or reloaded (no page refresh needed).

---

## Excel file format

The extension reads the **first sheet** of the workbook. The **first row must contain these exact column headers**:

| Column           | Required | Purpose                                                                 |
| ---------------- | -------- | ----------------------------------------------------------------------- |
| `Prompt Number`  | Only if using the From/To range | Numeric identifier used for range filtering.        |
| `Prompt`         | Yes      | The prompt text sent to Gemini.                                         |
| `Negative Prompt`| No       | If not empty, it is appended after the prompt (separated by one space). |

Example:

| Prompt Number | Prompt                                   | Negative Prompt        |
| ------------- | ---------------------------------------- | ---------------------- |
| 1             | A red forklift in a sunlit warehouse     | blurry, low quality    |
| 2             | A forklift lifting pallets at a dock     | text, watermark        |

Notes:

- Rows with an empty `Prompt` cell are ignored.
- Only `.xlsx` files are accepted by the file picker.

### What is actually sent to Gemini

For each row, the message typed into Gemini is:

- `Prompt` — when `Negative Prompt` is empty, or
- `Prompt` + a single space + `Negative Prompt` — when a negative prompt exists.

No label or extra wording is added.

---

## Installation

1. Download or clone this repository and make sure the extension files are in one folder (`manifest.json`, `popup.html`, `popup.js`, `content.js`, `xlsx.full.min.js`). If you downloaded the `.zip`, unzip it first.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked** and select the extension folder.
5. When you update the code later, click the **reload** icon on the extension's card in `chrome://extensions`.

---

## Usage

1. Open [gemini.google.com](https://gemini.google.com/) in the **active tab** and make sure the chat input box is visible.
2. Click the extension icon to open the popup.
3. Choose your `.xlsx` file.
4. *(Optional)* Enter **From #** and **To #** to send only a range of prompt numbers. Leave both empty to send all prompts.
5. Click **Start Sending**.
6. Watch progress in the box at the top-right of the Gemini page. The popup can be closed; sending continues on the page.

If the active tab is not `https://gemini.google.com/`, the popup shows `Please open gemini.google.com in the active tab first.` and nothing is sent. If no file is selected, it shows `Please choose an Excel file first.`

### Range selection (From / To)

- The filter is applied to the values in the **`Prompt Number`** column — not to row positions.
- Both ends are **inclusive**. For example, `310` to `350` sends **41** prompts (310, 311, … 350).
- The range is only applied when **both** fields are filled. If either is blank, all prompts in the file are sent.

---

## How it works

For every prompt, the content script running on the Gemini page does the following:

1. **Waits 2 seconds** (skipped for the very first prompt).
2. **Loads the prompt into the chat box** — it focuses the input, selects any existing text, and inserts the new text.
3. **Waits until the send button is enabled.**
4. **Counts the finished AI-generated images** currently on the page.
5. **Clicks send.**
6. **Waits until the number of finished images increases**, which confirms the image for this prompt has fully rendered.
7. **Increments the progress counter** (once per prompt) and moves on to the next prompt.

When every prompt has gone through this cycle, the progress box shows `All N/N prompts sent successfully.` where `N` is the exact number of prompts sent.

### Progress display

A small box appears in the top-right corner of the Gemini page. Depending on the stage it shows messages such as:

- `Sending prompt 3/41, generating image...`
- `Waiting for image 3/41 to finish (12.5s)...`
- `Sent 3/41`
- `All 41/41 prompts sent successfully.`

The counter advances only once per prompt, after its image is confirmed finished.

If the chat input box or the send button cannot be found on the page, the run halts and the box displays an error message along with how many prompts had been sent.

---

## Design notes

These are the decisions behind the implementation, useful if you plan to modify the code.

- **Text insertion uses `document.execCommand("insertText")`.** Gemini's input is a Quill-based rich-text editor (`<div class="ql-editor" contenteditable="true">` containing a `<p>`). Overwriting `textContent` directly breaks the editor's internal state and can leave the send button disabled; `execCommand` triggers the editor's normal input handling.
- **Image completion is detected from the page, not from timing.** Early versions relied on the send button's state or fixed delays, which fired the next prompt too early and resulted in fewer images than prompts sent. The extension now waits for a new finished image element to appear before continuing.
- **The content script is injected on demand.** Chrome does not inject manifest-declared content scripts into tabs that were already open when an extension is installed or reloaded. Instead, the popup injects `content.js` with `chrome.scripting.executeScript` right before starting, so it always works on the current tab.
- **Progress is shown on the page, not in the popup**, because the popup closes as soon as it loses focus.
- **SheetJS is bundled locally.** Manifest V3 does not allow loading remote scripts, so `xlsx.full.min.js` (SheetJS Community Edition **0.18.5**, Apache-2.0 licensed) ships inside the extension and parses the Excel file in the popup.

### Page elements the extension depends on

These selectors were confirmed against Gemini's page at the time of development:

| Purpose                     | Selector                                  |
| --------------------------- | ----------------------------------------- |
| Chat input box              | `.ql-editor`                              |
| Send button                 | `button[aria-label="Send message"]`       |
| Finished generated image    | `img[alt="AI generated"].loaded`          |

Gemini is a third-party site whose markup can change at any time. If the extension stops working after a Gemini update, inspect these elements in Chrome DevTools and update the selectors in `content.js`.

---

## Permissions

| Permission                                | Why it is needed                                                        |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| `activeTab`                               | Access the tab that is active when you click the extension.             |
| `scripting`                               | Inject `content.js` into the Gemini tab when you click **Start Sending**. |
| Host permission `https://gemini.google.com/*` | Allow the extension to run on Gemini pages only.                    |

The extension does not make any network requests of its own; the Excel file is parsed locally in the popup.

---

## Project structure

```
gemini-excel-extension/
├── manifest.json        # Extension manifest (Manifest V3)
├── popup.html           # Popup UI: file picker, From/To fields, Start button, status text
├── popup.js             # Parses the Excel file, applies range filter, merges negative prompts, injects content.js
├── content.js           # Runs on the Gemini page: types and sends prompts, detects finished images, shows progress
└── xlsx.full.min.js     # SheetJS 0.18.5 (bundled locally)
```

---

## Requirements and limitations

- Google Chrome (or another Chromium-based browser that supports Manifest V3 extensions).
- You must be signed in to Gemini and the chat page must be open in the active tab when you click **Start Sending**.
- Keep the Gemini tab open while prompts are being sent. Progress is held in the page itself, so reloading or closing the tab ends the run.
- Only the first sheet of the workbook is read, and only the `Prompt`, `Negative Prompt`, and `Prompt Number` columns are used.
- Because each prompt waits for its image to finish rendering, total run time depends on how long Gemini takes to generate each image.
