export var ConnectionStatus;
(function (ConnectionStatus) {
    ConnectionStatus["DISCONNECTED"] = "disconnected";
    ConnectionStatus["CONNECTING"] = "connecting";
    ConnectionStatus["CONNECTED"] = "connected";
    ConnectionStatus["RECONNECTING"] = "reconnecting";
    ConnectionStatus["FAILED"] = "failed";
})(ConnectionStatus || (ConnectionStatus = {}));
export const ClientEvent = {
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    RECONNECTING: 'reconnecting',
    RECONNECTED: 'reconnected',
    ERROR: 'error',
    MODELS_UPDATED: 'modelsUpdated',
    BALANCE_UPDATED: 'balanceUpdated',
    PROJECT_CREATED: 'projectCreated',
    PROJECT_PROGRESS: 'projectProgress',
    PROJECT_COMPLETED: 'projectCompleted',
    PROJECT_FAILED: 'projectFailed',
    JOB_COMPLETED: 'jobCompleted',
    JOB_FAILED: 'jobFailed',
    PROJECT_EVENT: 'projectEvent',
    JOB_EVENT: 'jobEvent',
    CHAT_TOKEN: 'chatToken',
    CHAT_COMPLETED: 'chatCompleted',
    CHAT_ERROR: 'chatError',
    CHAT_JOB_STATE: 'chatJobState',
    CHAT_MODELS_UPDATED: 'chatModelsUpdated',
};
//# sourceMappingURL=index.js.map