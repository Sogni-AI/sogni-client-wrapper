export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: {
      type?: string;
      properties?: Record<string, unknown>;
      required?: string[];
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}
