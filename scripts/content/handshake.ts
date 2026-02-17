import {CONST_CONFIGS, ContentMessage, AppConfigs, Ratings} from "../configs";
import {extractTaskId, withRetries} from "../util";

console.log("Handshake AI Util Extension - HANDSHAKE_TASKS - loaded into page");

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const waitForCondition = async (
    predicate: () => Promise<boolean> | boolean,
    timeout: number,
    step: number = 500
): Promise<boolean> => {
    const startTime = Date.now();
    while (true) {
        try {
            if (await predicate()) {
                return true;
            }
        } catch (e) {}
        if (Date.now() - startTime > timeout) {
            return false;
        }
        await sleep(step);
    }
};

const isSubmitButtonReady = (): boolean => {
    const elem = document.querySelector(CONST_CONFIGS.TASKS.SUBMIT_BTN_QUERY_SELECTOR) as HTMLButtonElement;
    return elem && elem.getAttribute('aria-disabled') === 'false';
};


async function performSubmit(timeoutMs: number): Promise<boolean> {
    const ready = await waitForCondition(async () => isSubmitButtonReady(), timeoutMs);
    if (!ready) {
        console.warn("Submit button never became ready.");
        return false;
    }
    try {
        const elem = document.querySelector(CONST_CONFIGS.TASKS.SUBMIT_BTN_QUERY_SELECTOR) as HTMLButtonElement;
        elem.click();
        return true;
    } catch (e) {
        console.warn("Error clicking submit", e);
        return false;
    }
}

function getValidationValues(validationQuery: string): string[] | null {
    const validationElems =[...document.querySelectorAll(validationQuery)];
    if (validationElems.length == 0) {
        return null;
    }
    return validationElems.map(el => el.textContent.trim());
}

function validateElementTextContent(elementQuery: string, expectedValues: string[] | null) : boolean {
    const values = getValidationValues(elementQuery);
    if (!values) return false;
    if (!expectedValues) {
        return true
    }
    if (values.length < expectedValues.length) return false;
    return expectedValues.every((val, index) => val === values[index]);
}

async function skipTaskLimitSection(): Promise<boolean> {
    const allToggleButtons = Array.from(document.querySelectorAll(CONST_CONFIGS.TASKS.OPTIONS_QUERY_SELECTOR));
    if (allToggleButtons.length > 3) {
        return true;
    }

    try {
        const contButton = document.querySelector(CONST_CONFIGS.EST_TIME.CONTINUE_BTN_QUERY_SELECTOR) as HTMLButtonElement;
        contButton.click();
    }catch(e) {
        console.warn("Could not skip task limit section", e);
    }
    return false;
}

async function selectTask(taskId: string, timeoutMs: number): Promise<boolean> {
    if (validateElementTextContent(CONST_CONFIGS.VERIFICATION_QUERY_SELECTOR, null)) {
        return true;
    }
    const allToggleButtons = Array.from(document.querySelectorAll(CONST_CONFIGS.TASKS.OPTIONS_QUERY_SELECTOR));
    if (allToggleButtons.length === 0) {
        console.error("No toggle buttons found.");
        return false;
    }
    let foundTask = false;
    for (const button of allToggleButtons) {
        const id = extractTaskId('/tasks/' + button.textContent);
        if (id && id == taskId) {
            console.log("Selecting task: ", taskId);
            const btn = button as HTMLButtonElement;
            if (btn.getAttribute('aria-pressed') === 'false') btn.click();
            foundTask = true;
            break;
        }
    }
    if (!foundTask) {
        try {
            console.log(`No task matching ${taskId}. Selecting last available option.`);
            const btn = (allToggleButtons.at(-1) as HTMLButtonElement);
            btn.click();
        } catch (e) {
            console.error("Could not select fallback task", e);
            return false;
        }
    }
    await performSubmit(timeoutMs);
    return false;
}

async function submitTaskDetails(actualTaskSlug: string, rating: Ratings, pollingTimeout: number, maxRetries: number, pollingInterval: number): Promise<boolean> {
    const history = getValidationValues(CONST_CONFIGS.VERIFICATION_QUERY_SELECTOR);
    if (!history) {
        console.error("Could not find validation history when submitting task details.");
        return false;
    }
    const taskSlug = history[0].trim() == CONST_CONFIGS.OTHER_TASK_NAME ? actualTaskSlug : CONST_CONFIGS.NON_OTHER_TASK_SIGNATURE;
    console.log(`Submitting task details: slug: ${taskSlug}, ratings: ${rating}`);
    if (! await withRetries(() => setInputValue(taskSlug, CONST_CONFIGS.TASKS.SLUG_INPUT_QUERY_SELECTOR,
        CONST_CONFIGS.SLUG_VERIFICATION_QUERY_SELECTOR, null, pollingTimeout), maxRetries, pollingInterval, "Set full task Id")) return false;
    history.push(taskSlug);
    if (! await withRetries(() => setInputValue(rating.average.toString(), CONST_CONFIGS.QA_FEEDBACKS.RATINGS.INPUT_QUERY_SELECTOR,
        CONST_CONFIGS.VERIFICATION_QUERY_SELECTOR, history, pollingTimeout), maxRetries, pollingInterval, "Set average rating")) return false;
    history.push(rating.average.toString());
    if (! await withRetries(() => setInputValue(rating.exceptional.toString(), CONST_CONFIGS.QA_FEEDBACKS.RATINGS.INPUT_QUERY_SELECTOR,
        CONST_CONFIGS.VERIFICATION_QUERY_SELECTOR, history, pollingTimeout), maxRetries, pollingInterval, "Set exceptional rating")) return false;
    history.push(rating.exceptional.toString());
    if (! await withRetries(() => setInputValue(rating.meetsExpectations.toString(), CONST_CONFIGS.QA_FEEDBACKS.RATINGS.INPUT_QUERY_SELECTOR,
        CONST_CONFIGS.VERIFICATION_QUERY_SELECTOR, history, pollingTimeout), maxRetries, pollingInterval, "Set meets expectations rating")) return false;
    history.push(rating.meetsExpectations.toString());
    if (! await withRetries(() => setInputValue(rating.someIssues.toString(), CONST_CONFIGS.QA_FEEDBACKS.RATINGS.INPUT_QUERY_SELECTOR,
        CONST_CONFIGS.VERIFICATION_QUERY_SELECTOR, history, pollingTimeout), maxRetries, pollingInterval, "Set some issues rating")) return false;
    history.push(rating.someIssues.toString());
    return await withRetries(() => setInputValue(rating.majorIssues.toString(), CONST_CONFIGS.QA_FEEDBACKS.RATINGS.INPUT_QUERY_SELECTOR,
        CONST_CONFIGS.VERIFICATION_QUERY_SELECTOR, history, pollingTimeout), maxRetries, pollingInterval, "Set major issues rating");
}

type InputType = HTMLInputElement | HTMLTextAreaElement;
async function setInputValue<T extends InputType>(value: string, inputQuery: string, validationQuery: string, validationHistory: string[] | null, timeoutMs: number, inputIndex: number = 0): Promise<boolean> {
    const expected = validationHistory ? [...validationHistory, value] : null;
    if(validateElementTextContent(validationQuery, expected)) {
        return true;
    }
    const inputReady = await waitForCondition(() => {
        const inputs = document.querySelectorAll(inputQuery);
        return inputs.length > inputIndex;
    }, timeoutMs);
    if (!inputReady) {
        console.warn(`Input at index ${inputIndex} not found.`);
        return false;
    }

    try {
        const inputs = document.querySelectorAll(inputQuery);
        const inputElem = inputs[inputIndex] as T;
        inputElem.value = value;
        inputElem.dispatchEvent(new Event('input', { bubbles: true }));
        inputElem.dispatchEvent(new Event('change', { bubbles: true }));
        await performSubmit(timeoutMs);
        return false;
    } catch (e) {
        console.warn("Error setting input value", e);
        return false;
    }
}

function showFloatingNotify(msg: string, floatingTimeMs: number) {
    const notify = document.createElement('div');

    Object.assign(notify.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        backgroundColor: '#D4FF33', // Your --primary-neon
        color: '#0A1414',           // Your --primary-dark
        padding: '12px 24px',
        borderRadius: '4px',
        fontWeight: 'bold',
        zIndex: '999999',
        fontFamily: 'Segoe UI, sans-serif',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        transition: 'opacity 0.5s ease'
    });

    notify.textContent = msg;
    document.body.appendChild(notify);

    setTimeout(() => {
        notify.style.opacity = '0';
        setTimeout(() => notify.remove(), 500);
    }, floatingTimeMs);
}

let isProcessingHandshake = false;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    console.info("HANDSHAKE TASKS content script starting: ", msg.action);
    const currentUrl = window.location.href;
    if (!currentUrl.trim().startsWith(CONST_CONFIGS.TASKS.HANDSHAKE_PREFIX)) {
        console.error("Current url is not a handshake task url. Current url: ", currentUrl);
        sendResponse({ status: "Failed", data: false, error: "Current url is not a handshake task url"});
        return true;
    }
    if (isProcessingHandshake) {
        console.error("Handshake already in progress. Ignoring message.");
        return false;
    }
    isProcessingHandshake = true;
    if (msg.action === ContentMessage.WRITE_HANDSHAKE) {
        let data: [AppConfigs, string, string, Ratings];
        try {
            data = msg.value as [AppConfigs, string, string, Ratings];
        } catch (e) {
            console.error("Invalid data format. Expected [configs, taskId, Ratings] but got: ", msg.value);
            isProcessingHandshake = false;
            sendResponse({ status: "Failed", data: false, error: "Invalid data format"});
            return true;
        }
        const [configs, taskId, taskSlug, ratingsToSubmit] = data;
        console.log("Received handshake data. taskId: ", taskId, "ratings: ", ratingsToSubmit);
        withRetries(() => skipTaskLimitSection(), configs.epMaxTries, configs.epInterval, "Skip task limit section").then(success => {
            if (!success) {
                console.error("Could not skip task limit section.");
                isProcessingHandshake = false;
                sendResponse({ status: "Failed", data: false, error: "Could not skip task limit section"});
            } else {
                console.log("Skipped task limit section successfully.");
                withRetries(() => selectTask(taskId, configs.epTimeout), configs.epMaxTries, configs.epInterval, "Task Selection").then(
                    task => {
                        if (!task) {
                            console.error("Task selection failed.");
                            isProcessingHandshake = false;
                            sendResponse({ status: "Failed", data: false, error: "Task selection failed"});
                        } else {
                            console.log("Submitted task selection. Proceeding to ratings...");
                            submitTaskDetails(taskSlug, ratingsToSubmit, configs.epTimeout, configs.epMaxTries, configs.epInterval).then(success => {
                                if (success) {
                                    console.log("Ratings submitted successfully.");
                                    isProcessingHandshake = false;
                                    sendResponse({ status: "Success", data: true });
                                } else {
                                    console.error("Ratings submit failed.");
                                    isProcessingHandshake = false;
                                    sendResponse({ status: "Failed", data: false, error: "Ratings submit failed"});
                                }
                            })
                        }
                    }
                )
            }
        })
        return true;
    } else if(msg.action == ContentMessage.SHOW_RESULT) {
        console.log("SHOW_RESULT msg value: ", msg.value);
        let data: [string, number];
        try {
            data = msg.value as [string, number];
        } catch (e) {
            console.error("Invalid data format. Expected string but got: ", msg.value);
            isProcessingHandshake = false;
            sendResponse({ status: "Failed", data: false, error: "Invalid data format"});
            return true;
        }
        console.log("Received result data. Message: ", data[0], "Floating time: ", data[1]);
        console.log("showing floating notification");
        showFloatingNotify(data[0], data[1]);
        isProcessingHandshake = false;
        sendResponse({ status: "Success", data: true });
        return true;
    }
    console.info("HANDSHAKE TASKS content script finished: ", msg.action);
});