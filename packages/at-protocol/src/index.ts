export type ATJsonValue =
  | string
  | number
  | boolean
  | null
  | ATJsonValue[]
  | { [key: string]: ATJsonValue };

export type ATJsonObject = { [key: string]: ATJsonValue };

export type ATActionRisk = "safe" | "confirm" | "dangerous";

export type ATActionPermission =
  | "navigate"
  | "clipboard"
  | "download"
  | "network"
  | "local-storage"
  | "user-data";

export type ATActionInvokeStatus =
  | "success"
  | "error"
  | "cancelled"
  | "need_confirm"
  | "need_clarify";

export type ATJsonSchema = {
  type?: string | string[];
  properties?: Record<string, ATJsonSchema>;
  required?: string[];
  items?: ATJsonSchema;
  enum?: ATJsonValue[];
  default?: ATJsonValue;
  description?: string;
  [key: string]: ATJsonValue | ATJsonSchema | Record<string, ATJsonSchema> | undefined;
};

export type ATActionDefinition = {
  id: string;
  title: string;
  description?: string;
  aliases?: string[];
  route?: string;
  inputSchema?: ATJsonSchema;
  risk?: ATActionRisk;
  requiresConfirm?: boolean;
  permissions?: ATActionPermission[];
  tags?: string[];
};

export type ATActionManifest = {
  protocolVersion: "at-actions.v1";
  appId: string;
  appName: string;
  appVersion?: string;
  origin?: string;
  actions: ATActionDefinition[];
};

export type ATActionInvokeRequest = {
  actionId: string;
  args?: ATJsonObject;
  source?: "assistant" | "hotkey" | "url" | "user" | string;
  requestId?: string;
};

export type ATActionInvokeResult = {
  status: ATActionInvokeStatus;
  message: string;
  data?: ATJsonObject;
  errorCode?: string;
};
