import crypto from "crypto";

// Verify a request really came from Twilio.
// Algorithm: concat the full URL + each POST param (sorted by key), HMAC-SHA1
// with the account's auth token, base64. Compare to X-Twilio-Signature.
export function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  const expected = crypto
    .createHmac("sha1", authToken)
    .update(Buffer.from(data, "utf-8"))
    .digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature || "");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// List the account's phone numbers and their configured inbound SMS webhook.
export async function listIncomingNumbers(
  accountSid: string,
  authToken: string
): Promise<{ phoneNumber: string; smsUrl: string; friendlyName: string }[]> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json?PageSize=100`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) throw new Error("Twilio lookup failed");
  const data = (await res.json()) as {
    incoming_phone_numbers?: {
      phone_number?: string;
      sms_url?: string;
      friendly_name?: string;
    }[];
  };
  return (data.incoming_phone_numbers ?? []).map((n) => ({
    phoneNumber: n.phone_number ?? "",
    smsUrl: n.sms_url ?? "",
    friendlyName: n.friendly_name ?? "",
  }));
}

// Fetch the account's remaining balance.
export async function getAccountBalance(
  accountSid: string,
  authToken: string
): Promise<{ balance: string; currency: string } | null> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Balance.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) return null;
  const d = (await res.json()) as { balance?: string; currency?: string };
  return { balance: d.balance ?? "", currency: d.currency ?? "" };
}

// Send an SMS via Twilio's REST API (no SDK needed — just a POST).
export async function sendSms(opts: {
  accountSid: string;
  authToken: string;
  from: string;
  to: string;
  body: string;
}): Promise<{ sid: string; status: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${opts.accountSid}/Messages.json`;
  const auth = Buffer.from(`${opts.accountSid}:${opts.authToken}`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ From: opts.from, To: opts.to, Body: opts.body }),
  });
  const data = (await res.json()) as { sid?: string; status?: string; message?: string };
  if (!res.ok) throw new Error(data.message || "Twilio send failed");
  return { sid: data.sid ?? "", status: data.status ?? "sent" };
}
