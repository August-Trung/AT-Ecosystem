import type {
  ATActionDefinition,
  ATActionInvokeRequest,
  ATActionInvokeResult,
  ATActionManifest,
  ATJsonObject,
} from "../../at-protocol/src";

export type ATActionHandler = (
  request: ATActionInvokeRequest
) => ATActionInvokeResult | Promise<ATActionInvokeResult>;

export type ATBrowserBridge = {
  version: "at-hotkey-sdk.v1";
  getManifest: () => ATActionManifest;
  invoke: (request: ATActionInvokeRequest) => Promise<ATActionInvokeResult>;
};

const ok = (message: string, data?: ATJsonObject): ATActionInvokeResult => ({
  status: "success",
  message,
  ...(data ? { data } : {}),
});

const error = (message: string, errorCode = "ACTION_ERROR"): ATActionInvokeResult => ({
  status: "error",
  message,
  errorCode,
});

const normalizeRoute = (route: string) => {
  const cleaned = route.trim();
  if (!cleaned) return "/";
  return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
};

export class ATActionRegistry {
  private readonly actions = new Map<string, ATActionDefinition>();
  private readonly handlers = new Map<string, ATActionHandler>();

  constructor(private readonly manifestBase: Omit<ATActionManifest, "actions">) {}

  registerAction(definition: ATActionDefinition, handler: ATActionHandler) {
    if (!definition.id.trim()) {
      throw new Error("AT action id is required.");
    }
    this.actions.set(definition.id, {
      risk: "safe",
      requiresConfirm: false,
      permissions: [],
      aliases: [],
      ...definition,
    });
    this.handlers.set(definition.id, handler);
    return this;
  }

  getManifest(): ATActionManifest {
    return {
      ...this.manifestBase,
      actions: Array.from(this.actions.values()),
    };
  }

  async invoke(request: ATActionInvokeRequest): Promise<ATActionInvokeResult> {
    const actionId = String(request.actionId || "").trim();
    const handler = this.handlers.get(actionId);
    if (!handler) {
      return error(`Unknown AT action: ${actionId || "(empty)"}`, "ACTION_NOT_FOUND");
    }

    try {
      return await handler({
        ...request,
        args: request.args || {},
      });
    } catch (err) {
      return error(err instanceof Error ? err.message : String(err), "ACTION_THROWN");
    }
  }

  exposeToWindow(name = "__AT") {
    if (typeof window === "undefined") return this;

    const bridge: ATBrowserBridge = {
      version: "at-hotkey-sdk.v1",
      getManifest: () => this.getManifest(),
      invoke: (request) => this.invoke(request),
    };
    (window as unknown as Record<string, ATBrowserBridge>)[name] = bridge;
    window.dispatchEvent(
      new CustomEvent("at:registry-ready", { detail: this.getManifest() })
    );
    return this;
  }

  async invokeFromUrl(location: Location = window.location) {
    const request = parseATInvocationFromUrl(location);
    if (!request) return null;
    const result = await this.invoke(request);
    window.dispatchEvent(
      new CustomEvent("at:action-result", {
        detail: {
          request,
          result,
        },
      })
    );
    return result;
  }
}

export const createATRegistry = (
  manifestBase: Omit<ATActionManifest, "actions">
) => new ATActionRegistry(manifestBase);

export const navigationResult = (route: string, title: string): ATActionInvokeResult =>
  ok(`Opened ${title}.`, { route: normalizeRoute(route) });

export const parseATInvocationFromUrl = (
  location: Pick<Location, "href" | "hash">
): ATActionInvokeRequest | null => {
  const url = new URL(location.href);
  const params = new URLSearchParams(url.search);
  const hash = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
  const hashQueryIndex = hash.indexOf("?");

  if (hashQueryIndex >= 0) {
    const hashParams = new URLSearchParams(hash.slice(hashQueryIndex + 1));
    hashParams.forEach((value, key) => {
      if (!params.has(key)) {
        params.set(key, value);
      }
    });
  }

  const actionId = params.get("atAction") || params.get("at_action");
  if (!actionId) return null;

  const argsRaw = params.get("atArgs") || params.get("at_args");
  let args: ATJsonObject = {};
  if (argsRaw) {
    try {
      const parsed = JSON.parse(argsRaw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        args = parsed as ATJsonObject;
      }
    } catch {
      args = {};
    }
  }

  return {
    actionId,
    args,
    requestId: params.get("atRequestId") || params.get("at_request_id") || undefined,
    source: params.get("atSource") || params.get("at_source") || "url",
  };
};

export type {
  ATActionDefinition,
  ATActionInvokeRequest,
  ATActionInvokeResult,
  ATActionManifest,
  ATJsonObject,
};
