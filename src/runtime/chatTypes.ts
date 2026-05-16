export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatTextContentPart {
  type: 'text';
  text: string;
}

export interface ChatImageContentPart {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

export type SogniChatContentPart = ChatTextContentPart | ChatImageContentPart;
export type ChatContentPart = SogniChatContentPart | Record<string, unknown>;
export type ChatContent = string | ChatContentPart[] | null;
export type SogniChatContent = string | SogniChatContentPart[] | null;

export interface ChatToolCall {
  id: string;
  type?: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface SogniChatToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatMessage {
  role: ChatRole;
  content: ChatContent;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ChatToolCall[];
}

export interface SogniChatMessage {
  role: ChatRole;
  content: SogniChatContent;
  name?: string;
  tool_call_id?: string;
  tool_calls?: SogniChatToolCall[];
}
