export const RUN_RECORD_SCHEMA_VERSION = 2;
export function emptyRunRecord() {
    return {
        schemaVersion: RUN_RECORD_SCHEMA_VERSION,
        run_id: '',
        startedAt: 0,
        endedAt: 0,
        user_request: '',
        model_id: '',
        runtime_config: {},
        tool_schemas: [],
        rounds: [],
        final_response: '',
        audit_results: [],
        job_ids: [],
        asset_ids: [],
        redacted: false,
    };
}
//# sourceMappingURL=types.js.map