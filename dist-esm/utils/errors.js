export class SogniError extends Error {
    constructor(message, code, statusCode, details, originalError) {
        super(message);
        this.name = 'SogniError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.originalError = originalError;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
    toErrorData() {
        return {
            code: this.code,
            message: this.message,
            statusCode: this.statusCode,
            details: this.details,
            originalError: this.originalError,
        };
    }
    static fromError(error, code = 'UNKNOWN_ERROR') {
        if (error instanceof SogniError) {
            return error;
        }
        if (error instanceof Error) {
            return new SogniError(error.message, code, undefined, undefined, error);
        }
        return new SogniError(String(error), code);
    }
}
export class SogniConnectionError extends SogniError {
    constructor(message, details, originalError) {
        super(message, 'CONNECTION_ERROR', undefined, details, originalError);
        this.name = 'SogniConnectionError';
    }
}
export class SogniAuthenticationError extends SogniError {
    constructor(message, details, originalError) {
        super(message, 'AUTHENTICATION_ERROR', 401, details, originalError);
        this.name = 'SogniAuthenticationError';
    }
}
export class SogniProjectError extends SogniError {
    constructor(message, details, originalError) {
        super(message, 'PROJECT_ERROR', undefined, details, originalError);
        this.name = 'SogniProjectError';
    }
}
export class SogniTimeoutError extends SogniError {
    constructor(message, timeoutMs, details) {
        super(message, 'TIMEOUT_ERROR', 408, { ...details, timeoutMs }, undefined);
        this.name = 'SogniTimeoutError';
    }
}
export class SogniBalanceError extends SogniError {
    constructor(message, details) {
        super(message, 'INSUFFICIENT_BALANCE', 402, details, undefined);
        this.name = 'SogniBalanceError';
    }
}
export class SogniValidationError extends SogniError {
    constructor(message, details) {
        super(message, 'VALIDATION_ERROR', 400, details, undefined);
        this.name = 'SogniValidationError';
    }
}
export class SogniConfigurationError extends SogniError {
    constructor(message, details) {
        super(message, 'CONFIGURATION_ERROR', undefined, details, undefined);
        this.name = 'SogniConfigurationError';
    }
}
export class SogniModelNotFoundError extends SogniError {
    constructor(modelId) {
        super(`Model not found: ${modelId}`, 'MODEL_NOT_FOUND', 404, { modelId }, undefined);
        this.name = 'SogniModelNotFoundError';
    }
}
export class SogniNetworkError extends SogniError {
    constructor(message, details, originalError) {
        super(message, 'NETWORK_ERROR', undefined, details, originalError);
        this.name = 'SogniNetworkError';
    }
}
//# sourceMappingURL=errors.js.map