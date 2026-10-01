document.getElementById("start").addEventListener("click", async () => {
  const file = document.getElementById("file").files[0];
  const status = document.getElementById("status");
  if (!file) {
    status.textContent = "Please choose an Excel file first.";
    return;
  }

  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  let rows = XLSX.utils.sheet_to_json(sheet);

  const from = document.getElementById("from").value;
  const to = document.getElementById("to").value;
  if (from !== "" && to !== "") {
    rows = rows.filter(row => row["Prompt Number"] >= Number(from) && row["Prompt Number"] <= Number(to));
  }

  const prompts = rows
    .map(row => row["Negative Prompt"] ? `${row["Prompt"]} ${row["Negative Prompt"]}` : row["Prompt"])
    .filter(Boolean);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url || !tab.url.startsWith("https://gemini.google.com/")) {
    status.textContent = "Please open gemini.google.com in the active tab first.";
    return;
  }

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    await chrome.tabs.sendMessage(tab.id, { type: "SEND_PROMPTS", prompts });
    status.textContent = `Started (${prompts.length} prompts). Watch progress on the Gemini page.`;
  } catch (err) {
    status.textContent = "Failed to reach the Gemini tab: " + err.message;
  }
});
