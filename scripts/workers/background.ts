import {
    confirmTabLoadingComplete,
    downloadFile,
    extractTaskId,
    findOrCreateTab,
    findTabs,
    focusTabAndWindow,
    getSettingsOrDefault,
    loadData,
    removeData,
    ratingsReviewsNum,
    saveData,
    sendContentMessage,
    sendContentMessageByUrl, extractFullTaskSlug,
} from "../util";
import {
    CONST_CONFIGS,
    ContentMessage,
    MessageResponse,
    AppConfigs,
    Ratings,
    RuntimeMessage,
    StoredData
} from "../configs";

// Service worker actions

export async function run(configs: AppConfigs): Promise<boolean> {
    console.info("Getting task data...");
    const [taskId, taskSlug, taskTabId] = await runTaskData(configs);
    if (!taskId || !taskSlug) return false;
    console.info("Getting ratings data...")
    const ratings = await runRatingsData(configs, taskTabId);
    if (!ratings) return false;

    if (configs.feedbackScreenshot) {
        console.info("Taking QA feedback capture...");
        await runCaptureQAFeedback();
    }
    console.info("Writing handshake...");
    return await runWriteHandshake(configs, taskId, taskSlug, ratings);
}

async function runTaskData(configs: AppConfigs): Promise<[string | null, string | null, number | null]> {
    let taskId: string | null = null;
    let taskSlug: string | null = null;
    let taskTabId: number | null = null;
    tasks: {
        const taskTab: chrome.tabs.Tab | null = await findMultimangoTaskTab(configs);
        if (!taskTab || !taskTab.id) break tasks;
        taskTabId = taskTab.id;
        const tabTaskId = getTaskId(taskTab);
        if (!tabTaskId) break tasks;
        taskId = tabTaskId;
        const tabTaskSlug = getTaskFullSlug(taskTab);
        if (!tabTaskSlug) break tasks;
        taskSlug = tabTaskSlug;
    }

    if ((!taskId || !taskSlug) && configs.tasksRememberLast) {
        console.warn("No open taskId found. Looking for stored ids")
        const loadedUrl: string | null = await loadData(StoredData.LAST_TASK_URL, CONST_CONFIGS.LAST_TASK_URL_STORAGE)
        if (loadedUrl) {
            console.info("Found stored url: ", loadedUrl);
            const loadedTaskId = extractTaskId(loadedUrl);
            if (loadedTaskId) {
                console.info("Found stored taskId: ", loadedTaskId);
                taskId = loadedTaskId;
            } else {
                console.warn("No taskId found in stored url");
            }
            const loadedTaskSlug = extractFullTaskSlug(loadedUrl);
            if (loadedTaskSlug) {
                console.info("Found stored taskSlug: ", loadedTaskSlug);
                taskSlug = loadedTaskSlug;
            } else {
                console.warn("No taskSlug found in stored url");
            }
        } else {
            console.warn("No stored taskId found");
        }
    }

    if (!taskId) {
        console.error("No taskId found");
    }
    if (!taskSlug) {
        console.error("No taskSlug found");
    }
    return [taskId, taskSlug, taskTabId];
}

async function runRatingsData(configs: AppConfigs, taskTabId: number | null): Promise<Ratings | null> {
    // [avgRating, numReviews]
    const ratingsInfoMsg: MessageResponse<[number, number]>  | MessageResponse<null> | undefined = configs.feedbackRememberRatings && taskTabId ? await sendContentMessage(taskTabId, ContentMessage.READ_RATINGS_PREVIEW): undefined;
    const ratingsInfoVal = ratingsInfoMsg ? ratingsInfoMsg.data : null;
    console.info("Ratings preview info: ", ratingsInfoVal);
    const ratingsInfo = ratingsInfoVal ? ratingsInfoVal : [0.0, 0];
    const savedRatings: [Ratings, string] | null = configs.feedbackRememberRatings && ratingsInfo ? await loadData(StoredData.RATINGS, configs.storageRatings) : null;
    let ratings: Ratings;
    if (!savedRatings || savedRatings[0].average !== ratingsInfo[0] || ratingsReviewsNum(savedRatings[0]) !== ratingsInfo[1]) {
        console.info("Ratings info changed. Updating ratings...");
        const newRatingsMsg: MessageResponse<Ratings> | MessageResponse<null> | undefined = await sendContentMessageByUrl(CONST_CONFIGS.QA_FEEDBACKS.URL, ContentMessage.READ_FULL_RATINGS, true);
        if (!newRatingsMsg || !newRatingsMsg.data) {
            console.error("Failed to get ratings info from QA feedback page");
            return null;
        }
        ratings = newRatingsMsg.data;
        console.info("New ratings info: ", ratings);
        if (configs.feedbackRememberRatings) {
            await saveData(StoredData.RATINGS, [ratings, Date.now().toString()], configs.storageRatings)
        }
    } else {
        console.info("Ratings info unchanged. Using saved ratings...");
        ratings = savedRatings[0];
    }
    return ratings;
}

async function runCaptureQAFeedback(): Promise<[string | null, number | null]> {
    const tab = await findOrCreateTab(CONST_CONFIGS.QA_FEEDBACKS.URL, true, false, CONST_CONFIGS.TIMEOUTS.PAGE_LOAD);
    if (!tab || !tab.id) return [null, null];
    const [activeTab, window] = await focusTabAndWindow(tab, [true, CONST_CONFIGS.QA_FEEDBACKS.URL]);
    if (!activeTab || !activeTab.id || !window) return [null, null];
    const dataUrlMsg: MessageResponse<string | null> | undefined = await sendContentMessage(activeTab.id, ContentMessage.SCREENSHOT_QA_FEEDBACK);
    if (!dataUrlMsg || !dataUrlMsg.data) {
        console.error("Failed to capture QA feedback screenshot");
        return [null, null];
    }
    const dataUrl = dataUrlMsg.data;

    let downloadId: number | null = null;
    if (dataUrl && CONST_CONFIGS.QA_FEEDBACKS.CAPTURE.DOWNLOAD) {
        downloadId = await downloadFile(dataUrl, CONST_CONFIGS.QA_FEEDBACKS.CAPTURE.DEFAULT_FILE_NAME, CONST_CONFIGS.QA_FEEDBACKS.CAPTURE.USE_TIME_STAMP, CONST_CONFIGS.QA_FEEDBACKS.CAPTURE.OPEN_SAVE_AS_DIALOG);
        return [dataUrl, downloadId]
    }

    return [dataUrl, null]
}

async function runWriteHandshake(configs: AppConfigs, taskId: string, taskSlug: string, ratings: Ratings): Promise<boolean> {
    const handshakeTabs = await findTabs({url: CONST_CONFIGS.TASKS.HANDSHAKE_URL});
    if (!handshakeTabs || handshakeTabs.length === 0) {
        console.error("Could not find any handshake tabs");
        return false;
    }
    let hanTab = handshakeTabs[0];
    if (!hanTab.id) return false;
    let loadedHanTab = await confirmTabLoadingComplete(hanTab);
    if (!loadedHanTab) return false;
    const [handshakeTab, _] = await focusTabAndWindow(hanTab);
    if (!handshakeTab || !handshakeTab.id) return false;
    const finalResult: MessageResponse<boolean> | undefined = await sendContentMessage(handshakeTab.id, ContentMessage.WRITE_HANDSHAKE, [configs, taskId, taskSlug, ratings!]);
    console.log("final result: ", finalResult)
    if (!finalResult) return false;
    return finalResult.data;
}

function getTaskId(tab: chrome.tabs.Tab): string | null {
    if (!tab.url) {
        console.error("Could not find url in task tab");
        return null;
    }
    const taskId = extractTaskId(tab.url);
    if (!taskId) {
        console.error("Could not extract task id from url: ", tab.url);
        return null;
    }

    console.info("Found task id: ", taskId);
    return taskId;
}

function getTaskFullSlug(tab: chrome.tabs.Tab): string | null {
    if (!tab.url) {
        console.error("Could not find url in task tab");
        return null;
    }
    const taskSlug = extractFullTaskSlug(tab.url);
    if (!taskSlug) {
        console.error("Could not extract task slug from url: ", tab.url);
        return null;
    }

    console.info("Found task slug: ", taskSlug);
    return taskSlug;
}

async function findMultimangoTaskTab(configs: AppConfigs): Promise<chrome.tabs.Tab | null> {
    const tabs = await findTabs({ url: CONST_CONFIGS.TASKS.MULTIMANGO_URL });
    if (!tabs) {
        console.error("Could not find any task tabs");
        return null;
    }

    if (!configs.tasksAlwaysPickFirst) {
        function getRankedTabs(tab: chrome.tabs.Tab): [chrome.tabs.Tab | null, number] {
            if (tab.id && tab.url) {
                const score = tab.active ? 1 : 0;
                return [tab, score];
            }
            return [null, -1];
        }

        const ranked = tabs.map(getRankedTabs).filter(id => id[0] !== null).toSorted((a, b) => b[1] - a[1]);
        if (ranked.length === 0) {
            console.error("All task ranking are null");
            return null;
        }
        console.info("Picking from ranked task ids - ALWAYS_PICK_FIRST_TASK=false: ", ranked)
        return ranked[0][0];
    } else {
        console.info("Picking first task tab - ALWAYS_PICK_FIRST_TASK=true");
        return tabs[0];
    }
}

function tabIdToUrlKeyTransform(tabId: number): string{
    return `HAI-${tabId}`;
}


chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, _tab) => {
    if (changeInfo.url && changeInfo.url.startsWith(CONST_CONFIGS.TASKS.MULTIMANGO_PREFIX)) {
        getSettingsOrDefault().then(configs => {
            if (configs.tasksRememberLast) {
                saveData(tabIdToUrlKeyTransform(tabId), changeInfo.url, CONST_CONFIGS.LAST_TASK_URL_STORAGE).then();
            }
        });
    }
});

chrome.tabs.onRemoved.addListener((tabId, _removeInfo) => {
    getSettingsOrDefault().then(configs => {
        if (configs.tasksRememberLast) {
            <Promise<string | null>>loadData(tabIdToUrlKeyTransform(tabId), CONST_CONFIGS.TASK_ID_TO_URL_MAP_STORAGE).then(loadedData => {
                const url: string | null = loadedData as string | null;
                console.info("url: ", url);
                if (url && url.trim().startsWith(CONST_CONFIGS.TASKS.MULTIMANGO_PREFIX)) {
                    saveData(StoredData.LAST_TASK_URL, url, CONST_CONFIGS.LAST_TASK_URL_STORAGE).then(_r => {
                        removeData(tabId.toString(), CONST_CONFIGS.TASK_ID_TO_URL_MAP_STORAGE).then();
                    })
                }
            })
        }
    })
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.info("Background script starting: ", message.action);
    if (message.action == RuntimeMessage.RUN) {
        getSettingsOrDefault().then(configs => {
            console.info("Configs: ");
            console.info(configs);
            run(configs).then(r => {
                console.log("Background run result success: ", r);
                sendResponse({ status: r ? "success" : "failure", });
                sendContentMessageByUrl(CONST_CONFIGS.TASKS.HANDSHAKE_URL, ContentMessage.SHOW_RESULT, false,
                    [r ? "Extension Succeeded" : "Extension Failed", CONST_CONFIGS.TIMEOUTS.NOTIFICATION]).then(_ => console.log("notification faded"))
            });
        });
        return true;
    }
    console.info("Background script finished: ", message.action);
});