import { ApiError } from "./errors";
import { reveal } from "./secret";

// Microsoft public client that allows password sign-in
const DATAVERSE_TOOLING_CLIENT_ID = "51f81489-12ee-4a9e-aaae-a2591f45987d";

type Config = {
  url: string;
  tokenRequest: URLSearchParams;
  tenant: string;
  callerId?: string;
};

let config: Config | undefined;

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

// Read a setting that may be encrypted
function secret(name: string): string | undefined {
  try {
    return reveal(env(name));
  } catch (e) {
    throw misconfigured(`${name} can't be decrypted: ${(e as Error).message}`);
  }
}

// Read the connection settings from the environment
function loadConfig(): Config {
  if (config) return config;

  const url = env("DATAVERSE_URL")?.replace(/\/+$/, "");
  if (!url) throw misconfigured("DATAVERSE_URL is not set");
  const scope = `${url}/.default`;
  const tenant = env("DATAVERSE_TENANT_ID") ?? "organizations";

  const clientId = env("DATAVERSE_CLIENT_ID");
  const clientSecret = secret("DATAVERSE_CLIENT_SECRET");
  const username = env("DATAVERSE_USERNAME");
  const password = secret("DATAVERSE_PASSWORD");

  const devToken = process.env.NODE_ENV !== "production" ? env("DATAVERSE_DEV_ACCESS_TOKEN") : undefined;
  if (devToken) {
    token = { value: devToken, expiresAt: Number.MAX_SAFE_INTEGER };
    config = { url, tenant, tokenRequest: new URLSearchParams(), callerId: env("DATAVERSE_CALLER_ID") };
  } else if (clientId && clientSecret) {
    config = {
      url,
      tenant,
      tokenRequest: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope,
      }),
    };
  } else if (username && password) {
    const callerId = env("DATAVERSE_CALLER_ID");
    if (!callerId && env("DATAVERSE_ALLOW_UNSCOPED") !== "true")
      throw misconfigured(
        "DATAVERSE_CALLER_ID is not set: password sign-in must impersonate the YE Portal Integration user " +
          "(set DATAVERSE_ALLOW_UNSCOPED=true to run with the account's own privileges instead)",
      );
    if (callerId && !/^[0-9a-f-]{36}$/i.test(callerId)) throw misconfigured("DATAVERSE_CALLER_ID is not a GUID");
    config = {
      url,
      tenant,
      callerId,
      tokenRequest: new URLSearchParams({
        grant_type: "password",
        client_id: env("DATAVERSE_CLIENT_ID") ?? DATAVERSE_TOOLING_CLIENT_ID,
        username,
        password,
        scope,
      }),
    };
  } else {
    throw misconfigured("set DATAVERSE_CLIENT_ID + DATAVERSE_CLIENT_SECRET, or DATAVERSE_USERNAME + DATAVERSE_PASSWORD");
  }
  return config;
}

// Log the detail, return a generic error
function misconfigured(detail: string): ApiError {
  console.error("Dataverse configuration error: " + detail);
  return new ApiError(500, "The booking service is not configured correctly.");
}

// Cached access token
let token: { value: string; expiresAt: number } | undefined;

function tokenRequestable(): boolean {
  return loadConfig().tokenRequest.has("grant_type");
}

// Get a token, renewing it before it expires
async function accessToken(): Promise<string> {
  if (token && Date.now() < token.expiresAt) return token.value;
  const cfg = loadConfig();
  const resp = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(cfg.tenant)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: cfg.tokenRequest,
    cache: "no-store",
  });
  const body = (await resp.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!resp.ok || !body.access_token) {
    console.error(`Dataverse sign-in failed: ${body.error}: ${body.error_description?.split("\r\n")[0]}`);
    throw new ApiError(502, "The booking service is temporarily unavailable.");
  }
  token = { value: body.access_token, expiresAt: Date.now() + ((body.expires_in ?? 3600) - 60) * 1000 };
  return token.value;
}

// Call the Dataverse Web API as the portal user
export async function dataverse<T = unknown>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
  options: { returnRepresentation?: boolean } = {},
): Promise<T> {
  const cfg = loadConfig();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await accessToken()}`,
    Accept: "application/json",
    "OData-MaxVersion": "4.0",
    "OData-Version": "4.0",
    Prefer: ['odata.include-annotations="OData.Community.Display.V1.FormattedValue"']
      .concat(options.returnRepresentation ? ["return=representation"] : [])
      .join(","),
  };
  if (body !== undefined) headers["Content-Type"] = "application/json; charset=utf-8";
  if (cfg.callerId) headers["MSCRMCallerID"] = cfg.callerId;

  const send = () =>
    fetch(`${cfg.url}/api/data/v9.2/${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  let resp = await send();
  if (resp.status === 401 && tokenRequestable()) {
    token = undefined;
    headers.Authorization = `Bearer ${await accessToken()}`;
    resp = await send();
  }
  if (resp.status === 204) return undefined as T;
  const text = await resp.text();
  if (!resp.ok) {
    let message = text;
    try {
      message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? text;
    } catch {}
    throw new DataverseFailure(resp.status, message);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

export class DataverseFailure extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// Escape a value for an OData string literal
export function odataString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
