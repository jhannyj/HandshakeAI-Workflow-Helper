# HandshakeAI Workflow Helper

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/plgifdgdcgafdjolpicdafjdbmdobekc?label=Available%20in%20Chrome%20Web%20Store&logo=google-chrome&color=4285F4)](https://chromewebstore.google.com/detail/plgifdgdcgafdjolpicdafjdbmdobekc)

**HandshakeAI Workflow Helper** is a productivity-focused browser extension designed to eliminate the manual overhead of synchronizing task data between **Multimango** and **Handshake AI**.

By automating data extraction and entry, this tool ensures your QA feedback and task progress are tracked accurately and reflected in real-time across both platforms.
With a simple click

** On install, close all Handshake AI and Multimango tabs and open the extension. This is so that in the future, the extension is loaded into the Handshake AI and Multimango tabs.

---

## Key Features

* **Automated Task Sync:** Bridges Multimango task data directly to Handshake AI without manual copy-pasting.
* **QA Feedback Tracker:** Remembers and monitors ratings, notifying you only when new feedback is detected.
* **Automated Screenshots:** Captures a rendering of feedback pages for your records whenever a rating update occurs.
* **Customizable Automation:** Toggle between "Run on Click" or "Run on Task Change" to fit your specific workflow.


## Installation (From GitHub)

Since this extension is being installed from a source repository rather than the Chrome Web Store (pending webstore review), follow these steps to load it into your browser:

### 1. Download the Source
* **Option A:** Clone the repository using Git:
    ```bash
    git clone https://github.com/jhannyj/HandshakeAI-Workflow-Helper.git
    ```
* **Option B:** Click the green **Code** button on the GitHub page and select **Download ZIP**. Extract the files to a folder on your computer.

### 2. Compile the Project
Compile the project using the following command:
```bash
npm run build
```
This will create a `dist` folder containing the compiled extension files.

### Alternative Source

Download the latest release from the GitHub and extract the files to a folder on your computer.

### 3. Load into Chrome/Edge
1.  Open your browser and navigate to `chrome://extensions` (or `edge://extensions`).
2.  Enable **Developer Mode** using the toggle in the top-right corner.
3.  Click the **Load unpacked** button.
4.  Select the folder containing the extension files (`dist` folder if compiling from source).

## How to Use

1. Open a task in Handshake AI.
2. Open a task in Multimango.
3. Finish Multimango task.
4. Click the extension icon.
5. Click the "SUBMIT" button.

The only requirement is that the Handshake AI page must remain open. The Multimango page can be closed if the "Store Last Task" feature is enabled.

## Disclaimer

> **This extension is an independent tool and is not officially associated with, endorsed by, or affiliated with Handshake, Handshake AI, or Multimango.** Use of this tool is at your own risk.

## TODO
- [ ] feat: add an option to track and log task completion separately from Handshake and allow Downloading of logs for bookkeeping.
- [ ] feat: filter out tasks that the user does not have access to from Handshake AI.
- [ ] feat: add expected task time to Multimago page
- [ ] feat: add an option to capture a "true" screenshot of the feedback page using desktopCapture API
- [ ] feat: use Google AI to find elements and verify data submission received
- [ ] fix: reload Handshake AI tab if the tab with url is open, but Message response is not received because "receiving end does not exist" - occurs when users install the extension but don't open it before opening Handshake AI or Multimango.
- [ ] chore: Handle users aren’t logged into Handshake AI or Multimango.
- [ ] chore: Forward errors and info from content scripts to the background script for easy of visibility OR add a create log option