import twilio from "twilio";

interface TwilioCredentials {
  accountSid: string;
  apiKey: string;
  apiKeySecret: string;
  phoneNumber: string;
}

async function getCredentials(): Promise<TwilioCredentials> {
  const hostname = process.env["REPLIT_CONNECTORS_HOSTNAME"];
  const replIdentity = process.env["REPL_IDENTITY"];
  const webReplRenewal = process.env["WEB_REPL_RENEWAL"];

  const xReplitToken = replIdentity
    ? "repl " + replIdentity
    : webReplRenewal
      ? "depl " + webReplRenewal
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error("Twilio not connected: missing Replit connector environment.");
  }

  const data = await fetch(
    "https://" +
      hostname +
      "/api/v2/connection?include_secrets=true&connector_names=twilio",
    {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    },
  ).then((r) => r.json()) as { items?: { settings: Record<string, string> }[] };

  const settings = data.items?.[0]?.settings;

  if (!settings?.account_sid || !settings?.api_key || !settings?.api_key_secret) {
    throw new Error("Twilio not connected: credentials unavailable.");
  }

  return {
    accountSid: settings.account_sid,
    apiKey: settings.api_key,
    apiKeySecret: settings.api_key_secret,
    phoneNumber: settings.phone_number ?? "",
  };
}

export async function getTwilioClient() {
  const { accountSid, apiKey, apiKeySecret } = await getCredentials();
  return twilio(apiKey, apiKeySecret, { accountSid });
}

export async function getTwilioFromPhone(): Promise<string> {
  const { phoneNumber } = await getCredentials();
  return phoneNumber;
}

function toE164India(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

export async function sendSms(to: string, body: string): Promise<void> {
  const client = await getTwilioClient();
  const from = await getTwilioFromPhone();
  await client.messages.create({
    to: toE164India(to),
    from,
    body,
  });
}

export async function sendSmsSilent(to: string, body: string, log?: (msg: string) => void): Promise<void> {
  try {
    await sendSms(to, body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (log) log(`SMS to ${to} failed: ${msg}`);
  }
}
