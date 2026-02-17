export enum StorageType {
    NONE = "NONE",
    LOCAL= "LOCAL",
    SYNC = "SYNC",
    SESSION = "SESSION",
}

export interface AppConfigs {
    readonly runOnClick: boolean,
    readonly runOnTaskChange: boolean,
    readonly tasksAlwaysPickFirst: boolean,
    readonly tasksRememberLast: boolean,
    readonly feedbackRememberRatings: boolean,
    readonly feedbackScreenshot: boolean,
    readonly epMaxTries: number,
    readonly epInterval: number,
    readonly epTimeout: number,
    readonly storageRatings: StorageType,
    readonly storageLastTaskUrl: StorageType,
}
 export const DEFAULT_APP_CONFIGS: AppConfigs = {
     runOnClick: false,
     runOnTaskChange: false,
     tasksAlwaysPickFirst: false,
     tasksRememberLast: false,
     feedbackRememberRatings: false,
     feedbackScreenshot: false,
     epMaxTries: 120,
     epInterval: 1_000,
     epTimeout: 1_000,
     storageRatings: StorageType.SYNC,
     storageLastTaskUrl: StorageType.SESSION,
 }

export const CONST_CONFIGS = {
    SETTINGS_STORAGE: StorageType.LOCAL,
    LAST_TASK_URL_STORAGE: StorageType.SESSION,
    TASK_ID_TO_URL_MAP_STORAGE: StorageType.SESSION,
    SUBMIT_SLEEP_MS: 500,
    UPDATE_LAST_TASK_URL_MS: 5_000,
    VERIFICATION_QUERY_SELECTOR: "div[data-block-turn-id]",
    SLUG_VERIFICATION_QUERY_SELECTOR: "[data-block-turn-id] .prose p",
    OTHER_TASK_NAME: "Other",
    NON_OTHER_TASK_SIGNATURE: "X",
    QA_FEEDBACKS : {
        URL: "https://www.multimango.com/qa-feedback",
        CAPTURE : {
            DOWNLOAD: true,
            OPEN_SAVE_AS_DIALOG: true,
            DEFAULT_FILE_NAME: "qa-feedback",
            USE_TIME_STAMP: true,
            STORAGE: StorageType.SESSION,
        },
        RATINGS : {
            FULL_QUERY_SELECTOR: "span.font-semibold.text-foreground.min-w-\\[2ch\\].text-right",
            AVG_RATING_SELECTOR: ".text-emerald-700.font-bold",
            NUM_REVIEWS_SELECTOR: ".bg-emerald-50 .mt-2.text-xs.text-muted-foreground",
            INPUT_QUERY_SELECTOR: "input[type='number']",
        },
    },
    TASKS: {
        MULTIMANGO_URL: "https://www.multimango.com/tasks/*",
        MULTIMANGO_PREFIX: "https://www.multimango.com/tasks/",
        HANDSHAKE_URL: "https://ai.joinhandshake.com/annotations/fellow/task/*/run",
        HANDSHAKE_PREFIX: "https://ai.joinhandshake.com/annotations/fellow/task/",
        OPTIONS_QUERY_SELECTOR: "button[aria-pressed]",
        SUBMIT_BTN_QUERY_SELECTOR: "button[aria-label='Submit']",
        SLUG_INPUT_QUERY_SELECTOR: "textarea",
    },
    TIMEOUTS: {
        PAGE_LOAD: 10_000,
        MSG: 300_000,
        SCREENSHOT: 10_000,
        RUN: 600_000,
        NOTIFICATION: 5_000,
    },
    EST_TIME: {
        NUM_NON_TASK_BUTTONS: 3,
        CONTINUE_BTN_QUERY_SELECTOR: "button[aria-label='Continue']",
    }
} as const;

export enum RuntimeMessage {
    RUN = "RUN",
}

export enum ContentMessage {
    READ_FULL_RATINGS = "READ_FULL_RATINGS",
    READ_RATINGS_PREVIEW = "READ_RATINGS_PREVIEW",
    SCREENSHOT_QA_FEEDBACK = "SCREENSHOT_QA_FEEDBACK",
    WRITE_HANDSHAKE = "WRITE_HANDSHAKE",
    SHOW_RESULT = "SHOW_RESULT",
}

export enum StoredData {
    RATINGS = "RATINGS", // [Ratings, savedTime]
    QA_CAPTURE = "QA_CAPTURE", // [imageUrl, downloadId, savedTime]
    SETTINGS = "SETTINGS",
    LAST_TASK_URL = "LAST_TASK_URL",
}

export interface Ratings {
    readonly average: number,
    readonly exceptional: number,
    readonly meetsExpectations: number,
    readonly someIssues: number,
    readonly majorIssues: number,
}

export interface MessageResponse<T> {
    status: string,
    data: T,
    error?: string,
}