export interface ChatTextPart {
  type: "text";
  text: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  parts: ChatTextPart[];
}

export type ChatStatus = "ready" | "submitted" | "streaming" | "error";
