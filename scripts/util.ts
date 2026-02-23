import {
    CONST_CONFIGS,
    ContentMessage, DEFAULT_APP_CONFIGS, MessageResponse,
    AppConfigs,
    Ratings,
    RuntimeMessage,
    StorageType,
    StoredData
} from "./configs";

/**
 * @deprecated Requires users to click the extension icon on the tab, so doesn't quite work. Use content script instead.
 */
export async function captureTab(url: string, screenshotTimeout: number = CONST_CONFIGS.TIMEOUTS.SCREENSHOT, pageLoadTimeout: number = CONST_CONFIGS.TIMEOUTS.PAGE_LOAD): Promise<string | null> {
    const tab = await findOrCreateTab(url, true, true, pageLoadTimeout);
    if (!tab) return null;
    const [activeTab, window] = await focusTabAndWindow(tab, [true, url]);
    if (!activeTab || !window) return null;

    const [snapErr, image] = await safe(
        withTimeout(chrome.tabs.captureVisibleTab(), screenshotTimeout, "Screenshot timed out")
    );
    if (snapErr || !image) {
        console.error("Failed to capture screenshot at: ", activeTab.url);
        console.error(snapErr?.message);
        return null;
    }
    console.info("Captured screenshot at: ", activeTab.url);
    return image
}

export async function downloadFile(dataUrl: string, fileName: string, timeStamp: boolean, save_as: boolean): Promise<number | null> {
    const hasPermission = await chrome.permissions.contains({
        permissions: ['downloads']
    });

    if (!hasPermission) {
        console.error("Missing required permission: downloads");
        return null;
    }

    const timestamp = timeStamp ? "-" + new Date().toISOString().replace(/[:.]/g, '-') : "";
    const finalName = `${fileName}${timestamp}.png`;

    const [err, downloadId] = await safe(chrome.downloads.download({
        url: dataUrl,
        filename: finalName,
        conflictAction: 'uniquify',
        saveAs: save_as,
    }));

    if (err || !downloadId) {
        console.error("Failed to save file to :", finalName);
        return null;
    }
    console.info("Saved file to: ", finalName);
    return downloadId;
}

export async function findOrCreateTab(url: string, waitForLoading: boolean = true, refreshIfFind: boolean = false, pageLoadTimeout: number = CONST_CONFIGS.TIMEOUTS.PAGE_LOAD): Promise<chrome.tabs.Tab | null> {
    const tabs = await findTabs({ url: url });
    let targetTab: chrome.tabs.Tab | null = null;
    if (tabs && tabs.length > 0) {
        const firstTab = tabs[0];
        if (refreshIfFind) {
            if (!firstTab.id || !await refreshTab(firstTab.id)) return null;
            return findOrCreateTab(url, waitForLoading, false, pageLoadTimeout);
        } else {
            targetTab = firstTab;
        }
    } else {
        const newTab = await createTab(url);
        if (!newTab || !newTab.id) {
            return null;
        }
        targetTab = newTab;
    }

    if (!waitForLoading) return targetTab;
    return await confirmTabLoadingComplete(targetTab, true, pageLoadTimeout);
}

export async function focusTabAndWindow(tab: chrome.tabs.Tab, [validate, url]: [boolean, string | null] = [false, null]): Promise<[chrome.tabs.Tab | null, chrome.windows.Window | null]> {
    const targetTab = await makeActiveTab(tab);
    if (!targetTab) return [null, null];
    const window = await focusWindow(targetTab);
    if (!window) return [null, null];

    if (!validate) return [targetTab, window];
    if (!validateTabAndWindowFocus(url, targetTab, window)) return [null, null];
    return [targetTab, window];
}

export function validateTabAndWindowFocus(url: string | null, tab: chrome.tabs.Tab, window: chrome.windows.Window): boolean {
    if (!tab.id || !window.id) {
        console.error("Tab or window has no id");
        console.error(tab.id);
        console.error(window.id);
        return false;
    }
    if (tab.windowId !== window.id) {
        console.error("Tab and window ids do not match. Tab windowId: ", tab.windowId, "Window id: ", window.id);
        return false;
    }
    if (tab.status !== "complete") {
        console.error("Tab is not ready. Status: ", tab.status);
        return false;
    }
    if (url) {
        if (tab.url !== url) {
            console.error("Tab url does not match. Expected: ", url, "Actual: ", tab.url);
            return false;
        }
    }
    if (!tab.active) {
        console.error("Tab is not active");
        return false;
    }
    if (!window.focused) {
        console.error("Window is not focused");
        return false;
    }
    console.info("Tab and window focus validation successful.");
    return true
}

export async function findTabs(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[] | null> {
    const [queryErr, tabs] = await safe(chrome.tabs.query(queryInfo));
    if (queryErr || tabs === null) {
        console.error("Critical Chrome API error during tab query", queryErr);
        return null;
    } else if (tabs.length === 0) {
        console.warn("No tabs found. Query: ", queryInfo);
        return null;
    }
    console.info("Found existing tabs. Query: ", queryInfo);
    return tabs;
}

export async function refreshTab(tabId: number): Promise<boolean> {
    const [reloadErr, _] = await safe(chrome.tabs.reload(tabId, { bypassCache: true }));
    if (reloadErr) {
        console.error("Failed to refresh tab: ", tabId);
        return false;
    }
    console.info("Refreshed tab: ", tabId);
    return true;
}

export async function createTab(url: string): Promise<chrome.tabs.Tab | null> {
    const [newTabError, newTab] = await safe(chrome.tabs.create({ url: url }));
    if (newTabError || !newTab || !newTab.id) {
        console.error("Failed to create tab. url: ", url);
        return null;
    }
    console.info("Created new tab for url: ", url);
    return newTab;
}

export async function makeActiveTab(initTab: chrome.tabs.Tab): Promise<chrome.tabs.Tab | null> {
    if (!initTab.id) {
        console.error("Failed to make tab active. Tab has no id: ", initTab.url);
        return null;
    }
    const [tabUpdError, tabUpdated] = await safe(chrome.tabs.update(initTab.id, { active: true }));
    if (tabUpdError || !tabUpdated || !tabUpdated.active) {
        console.error("Failed to bring tab to focus. url: ", initTab.url);
        console.error(tabUpdError?.message);
        return null;
    }
    console.info(`Brought tab to focus. url: ${tabUpdated.url} id: ${tabUpdated.id}`);
    return tabUpdated;
}

export async function getCurrentTab(): Promise<chrome.tabs.Tab | null> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length !== 0) {
        console.info("Found current tab. url: ", tabs[0].url);
        return tabs[0];
    }
    console.warn("No current tab found.");
    return null;
}

export async function focusWindow(initTab: chrome.tabs.Tab): Promise<chrome.windows.Window | null> {
    const [windUpdError, windowUpdated] = await safe(chrome.windows.update(initTab.windowId, { focused: true }));
    if (windUpdError || !windowUpdated || !windowUpdated.focused) {
        console.error("Failed to bring window to focus. It might have been closed. url: ", initTab.url)
        console.error(windUpdError?.message)
        return null;
    }
    console.info("Brought window to focus. url: ", initTab.url);
    console.info("Window id: ", windowUpdated.id);
    return windowUpdated;
}

/**
Can fail sometimes if tab is already loaded.
 */
export async function confirmTabLoadingComplete(initTab: chrome.tabs.Tab, refreshIfUndefined: boolean = true, timeout_ms: number = CONST_CONFIGS.TIMEOUTS.PAGE_LOAD): Promise<chrome.tabs.Tab | null> {
    if (!initTab.id) {
        console.error("Failed to confirm tab loading complete. Tab has no id: ", initTab.url);
        return null;
    }
    const nowTab = await chrome.tabs.get(initTab.id);
    if (nowTab.status === 'complete') return nowTab;
    if (refreshIfUndefined && !nowTab.status) await refreshTab(initTab.id);

    const [err, tab] = await safe(withTimeout(waitForTabComplete(
            initTab.id),
        timeout_ms,
        "Wait for load timeout"));
    if (err || !tab) {
        console.error("Could not wait for tab to complete loading: ", initTab.url);
        console.error(err?.message);
        return null;
    }
    console.info("Successfully waited for tab to complete loading: ", tab.url);
    return tab;
}

export function waitForTabComplete(tabId: number): Promise<chrome.tabs.Tab> {
    return new Promise((resolve) => {
        const listener = (id: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => {
            const isComplete = changeInfo.status === 'complete' || tab.status === 'complete';
            const hasUrl = tab.url && tab.url !== "" && tab.url !== "about:blank";

            if (id === tabId && isComplete && hasUrl) {
                chrome.tabs.onUpdated.removeListener(listener);
                console.info("Tab is ready with URL:", tab.url);
                resolve(tab);
            }
        };
        chrome.tabs.onUpdated.addListener(listener);
    });
}

export function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    errorMessage: string = "Operation timed out"
): Promise<T> {
    let timeout: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
            reject(new Error(errorMessage));
        }, ms);
    });

    return Promise.race([
        promise,
        timeoutPromise
    ]).finally(() => {
        clearTimeout(timeout);
    });
}

export async function withRetries(
    fn: () => Promise<boolean>,
    retries: number,
    delay_ms: number,
    function_description: string = "N/A"
): Promise<boolean> {
    let attemptsLeft = retries;
    while (attemptsLeft >= 0) {
        const result = await fn();
        if (result) {
            return true;
        }
        console.warn(`Attempt failed. function: ${function_description}`);
        if (attemptsLeft === 0) break;
        console.warn(`Retrying... with ${attemptsLeft} attempts left.`);
        attemptsLeft--;
        await new Promise(resolve => setTimeout(resolve, delay_ms));
    }
    console.error(`Failed to execute function: ${function_description} after ${retries} attempts.`);
    return false;
}

export async function saveData(key: string, data: any, type: StorageType, log: boolean=true): Promise<boolean> {
    if (type == StorageType.NONE) {
        if (log) console.warn("Tried to save data to storage, but type is NONE. Skipping.");
        return false;
    }

    const hasPermission = await chrome.permissions.contains({
        permissions: ['storage']
    });
    if (!hasPermission) {
        console.error("Missing required permission: storage to save data.");
        return false;
    }

    let saveOutput;
    switch (type) {
        case StorageType.SYNC:
            saveOutput = await safe(chrome.storage.sync.set({ [key]: data }));
            break;
        case StorageType.LOCAL:
            saveOutput = await safe(chrome.storage.local.set({ [key]: data }));
            break;
        case StorageType.SESSION:
            saveOutput = await safe(chrome.storage.session.set({ [key]: data }));
            break;
    }
    if (saveOutput[0]) {
        if (log) console.error(`Failed to save data. key: ${key}, value: ${data}, storage: ${type}`);
        return false;
    }
    if (log) console.info(`Saved data. key: ${key}, value: ${data}, storage: ${type}`);
    return true;
}

export async function loadData<T>(key: string | string[] | Record<string, any>, type: StorageType, log: boolean=true): Promise<T | null> {
    if (type == StorageType.NONE) {
        if (log) console.warn("Tried to load data from storage, but type is NONE. Skipping.");
        return null;
    }

    const hasPermission = await chrome.permissions.contains({
        permissions: ['storage']
    });
    if (!hasPermission) {
        console.error("Missing required permission: storage to load data.");
        return null;
    }

    let loadOutput;
    switch (type) {
        case StorageType.SYNC:
            loadOutput = await safe(chrome.storage.sync.get(key));
            break;
        case StorageType.LOCAL:
            loadOutput = await safe(chrome.storage.local.get(key));
            break;
        case StorageType.SESSION:
            loadOutput = await safe(chrome.storage.session.get(key));
            break;
    }
    const [loadErr, result] = loadOutput;
    if (loadErr || result === null) {
        if (log) console.error(`Failed to load data. key: ${key}, storage: ${type}`);
        return null;
    }
    let returnValue: T | null = null;
    try {
        if (typeof key === 'string' && key in result) {
            returnValue = result[key] as T;
        } else if (Array.isArray(key) && key.every(k => k in result)) {
            returnValue = key.map(k => result[k]) as T;
        } else if (typeof key === 'object' && Object.keys(key).every(k => k in result)) {
            returnValue = Object.keys(key).map(key => result[key]) as T;
        }
    } catch (e) {
        console.error("Failed to cast loaded data to type: ", e);
        return null;
    }
    if (returnValue !== null)  {
        if (log) console.info(`Loaded data. key: ${key}, storage: ${type}`);
    } else {
        if (log) console.error(`Failed to load data. key: ${key}, storage: ${type}`);
    }

    return returnValue;
}


export async function removeData(key: string | string[], type: StorageType, log: boolean=true): Promise<boolean> {
    if (type == StorageType.NONE) {
        if (log) console.warn("Tried to remove data from storage, but type is NONE. Skipping.");
        return false;
    }

    const hasPermission = await chrome.permissions.contains({
        permissions: ['storage']
    });
    if (!hasPermission) {
        console.error("Missing required permission: storage to remove data.");
        return false;
    }

    let removeOutput;
    switch (type) {
        case StorageType.SYNC:
            removeOutput = await safe(chrome.storage.sync.remove(key));
            break;
        case StorageType.LOCAL:
            removeOutput = await safe(chrome.storage.local.remove(key));
            break;
        case StorageType.SESSION:
            removeOutput = await safe(chrome.storage.session.remove(key));
            break;
    }
    if (removeOutput[0]) {
        if (log) console.error(`Failed to remove data. key: ${key}, storage: ${type}`);
        return false;
    }
    if (log) console.info(`Removed data. key: ${key}, storage: ${type}`);
    return true;
}

export async function getSettingsOrDefault(): Promise<AppConfigs> {
    const settings: AppConfigs | null = await loadData(StoredData.SETTINGS, CONST_CONFIGS.SETTINGS_STORAGE);
    if (!settings) return DEFAULT_APP_CONFIGS;
    return settings;
}

export async function safe<T>(promise: Promise<T>): Promise<[Error | null, T | null]> {
    try {
        const data = await promise;
        return [null, data];
    } catch (err) {
        return [err instanceof Error ? err : new Error(String(err)), null];
    }
}

export function extractTaskId(url: string): string | null {
    // Regex breakdown:
    // \/tasks\/  : looks for the literal string "/tasks/"
    // (\d+)      : capturing group that matches one or more digits
    // -          : looks for the following hyphen
    const match = url.match(/\/tasks\/(\d+)-/);
    return match ? match[1] : null;
}

export function extractFullTaskSlug(url: string): string | null {
    // Regex breakdown:
    // \/tasks\/  : looks for the literal string "/tasks/"
    // (          : start capturing group
    //  [^/?\s]+  : match one or more characters that are NOT a slash (/),
    //              question mark (?), or whitespace (\s)
    // )          : end capturing group
    const match = url.match(/\/tasks\/([^/?\s]+)/);
    return match ? match[1] : null;
}

export async function sendRuntimeMessage<T, V>(msg: RuntimeMessage, value: V | null = null, timeoutMS: number = CONST_CONFIGS.TIMEOUTS.RUN): Promise<T | undefined> {
    const [sendErr, response] = await safe(withTimeout(chrome.runtime.sendMessage({ action: msg, value: value}), timeoutMS));
    if (sendErr || !response) {
        console.error("Failed to send runtime msg: ", msg);
        console.error(sendErr?.message);
        console.info("Consider checking if script is alive and checking return values")
        return undefined;
    }
    return response;
}

export async function sendContentMessage<T, V>(tabId: number, msg: ContentMessage, value: V | null = null, timeoutMs: number = CONST_CONFIGS.TIMEOUTS.MSG,): Promise<T | undefined> {
    const [sendErr, response] = await safe(withTimeout(chrome.tabs.sendMessage(tabId, { action: msg, value: value}), timeoutMs));
    if (sendErr || !response) {
        console.error("Failed to send message to tab: ", tabId, msg);
        console.error(sendErr?.message);
        console.info("Consider checking if tab is alive and checking return values")
        return undefined;
    }
    return response;
}

export async function sendContentMessageByUrl<T, V>(url: string, msg: ContentMessage, openNewTabIfMissing: boolean = false, value: V | null = null, timeoutMs: number = CONST_CONFIGS.TIMEOUTS.MSG, indexer: (tabs: chrome.tabs.Tab[]) => chrome.tabs.Tab = (tabs) => tabs[0]): Promise<T | undefined> {
    async function helper(tab: chrome.tabs.Tab) {
        if (!tab.id) {
            console.error(`Indexed tab with url: ${url} has no id. Cannot send message: `, msg)
            return undefined;
        }
        return await sendContentMessage<T, V>(tab.id, msg, value, timeoutMs);
    }
    const tabs = await findTabs({url: url});
    if (tabs && tabs.length > 0) {
        return helper(indexer(tabs));
    } else if (openNewTabIfMissing) {
        console.info(`No tab found with url: ${url}. Creating new tab.`)
        const tab = await createTab(url);
        if (!tab || !tab.id) {
            console.error(`Failed to create tab with url: ${url}. Cannot send message: `, msg)
            return undefined;
        }
        const completeTab = await waitForTabComplete(tab.id);
        if (!completeTab || !completeTab.id) {
            console.error(`Failed to wait for tab with url: ${url} to complete loading. Cannot send message: `, msg)
            return undefined;
        }
        return helper(completeTab);
    }
    console.error(`No tab found with url: ${url}. Cannot send message: `, msg)
    return undefined;
}

export function ratingsReviewsNum(ratings: Ratings): number {
    return ratings.exceptional + ratings.meetsExpectations + ratings.someIssues + ratings.majorIssues;
}

export function isMessageResponse(obj: any, dataValidator: (data: any) => boolean): obj is MessageResponse<any> {
    return obj !== null && typeof obj === 'object' && 'data' in obj && dataValidator(obj.data);
}
