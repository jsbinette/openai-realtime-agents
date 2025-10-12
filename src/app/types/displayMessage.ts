export type DisplaySize = "tiny" | "small" | "medium" | "large" | "huge";

export type ListItem =
  | string
  | {
      title: string;
      subtitle?: string;
      variant?: "default" | "info" | "success" | "warning" | "danger";
    };

export type DisplayMessage =
  | TextMessage
  | MathMessage
  | ListMessage
  | ImageMessage
  | BackgroundMessage;

export interface DisplayBase {
  ticker?: string;
  ts?: string;
}

export interface SizedDisplay extends DisplayBase {
  size?: DisplaySize;
}

export interface TextMessage extends SizedDisplay {
  kind: "text";
  content: string;
}

export interface MathMessage extends SizedDisplay {
  kind: "math";
  formula: string;
}

export interface ListMessage extends SizedDisplay {
  kind: "list";
  items: ListItem[];
}

export interface ImageMessage extends DisplayBase {
  kind: "image";
  url: string;
}

export interface BackgroundMessage extends DisplayBase {
  kind: "background";
  /**
   * JSON-serializable payload forwarded to the background renderer.
   */
  content: unknown;
}

export const DEFAULT_DISPLAY_SIZE: DisplaySize = "medium";

export const isListItemObject = (value: ListItem): value is Exclude<ListItem, string> =>
  typeof value === "object" && value !== null;
