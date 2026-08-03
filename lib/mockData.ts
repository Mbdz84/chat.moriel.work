// Mock data for UI development. Replaced by real Supabase/Twilio data later.
// A conversation is keyed by phone number. Display names come from Caller ID
// (see lib/callerId.tsx), NOT from the conversation itself.

export type Message = {
  id: string;
  body: string;
  direction: "in" | "out"; // in = received, out = sent by us
  timestamp: string; // ISO
  status?: "sent" | "delivered" | "read"; // for outgoing
};

export type ConvoStatus = "inbox" | "blocked" | "archived";

export type Contact = {
  id: string;
  number: string; // E.164
  avatarColor: string;
  unread: number;
  status: ConvoStatus;
  muted: boolean;
  messages: Message[];
};

function iso(minsAgo: number): string {
  return new Date(Date.now() - minsAgo * 60_000).toISOString();
}

export const contacts: Contact[] = [
  {
    id: "c1",
    number: "+12194027666",
    avatarColor: "#6366f1",
    unread: 0,
    status: "inbox",
    muted: false,
    messages: [
      { id: "m1", body: "Call me", direction: "out", timestamp: iso(200), status: "read" },
      { id: "m2", body: "Hi, this is your locksmith technician. Please call me back.", direction: "out", timestamp: iso(180), status: "delivered" },
    ],
  },
  {
    id: "c2",
    number: "+19086638211",
    avatarColor: "#ef4444",
    unread: 10,
    status: "inbox",
    muted: true,
    messages: [
      { id: "m3", body: "Expert Locksmith Chicago. Name: cx, need a rekey today.", direction: "in", timestamp: iso(30) },
      { id: "m4", body: "Sure — what's the address?", direction: "out", timestamp: iso(28), status: "read" },
      { id: "m5", body: "I'll send it over in a sec.", direction: "in", timestamp: iso(15) },
    ],
  },
  {
    id: "c3",
    number: "+14073501222",
    avatarColor: "#f59e0b",
    unread: 0,
    status: "inbox",
    muted: true,
    messages: [
      { id: "m6", body: "Company: American Services. Job: NA8XS", direction: "in", timestamp: iso(1500) },
      { id: "m7", body: "Got it, assigning a tech now.", direction: "out", timestamp: iso(1490), status: "read" },
    ],
  },
  {
    id: "c4",
    number: "+17735104937",
    avatarColor: "#10b981",
    unread: 1,
    status: "inbox",
    muted: false,
    messages: [
      { id: "m8", body: "It's the locksmith, please call me back.", direction: "in", timestamp: iso(120) },
    ],
  },
  {
    id: "c5",
    number: "+13125238019",
    avatarColor: "#8b5cf6",
    unread: 0,
    status: "inbox",
    muted: false,
    messages: [
      { id: "m9", body: "Hi, this is your locksmith technician. Please call me back.", direction: "out", timestamp: iso(2600), status: "delivered" },
    ],
  },
  {
    id: "c6",
    number: "+17732946384",
    avatarColor: "#0ea5e9",
    unread: 0,
    status: "inbox",
    muted: false,
    messages: [
      { id: "m10", body: "Call me", direction: "in", timestamp: iso(2700) },
    ],
  },
  {
    id: "c7",
    number: "+17738829766",
    avatarColor: "#ec4899",
    unread: 0,
    status: "archived",
    muted: false,
    messages: [
      { id: "m11", body: "Source: NOYS Locksmiths. Job ID: C6Q4Y", direction: "in", timestamp: iso(2760) },
      { id: "m12", body: "Thanks, closing this out.", direction: "out", timestamp: iso(2750), status: "read" },
    ],
  },
  {
    id: "c8",
    number: "+15125550101",
    avatarColor: "#64748b",
    unread: 0,
    status: "blocked",
    muted: false,
    messages: [
      { id: "m13", body: "STOP messaging me", direction: "in", timestamp: iso(4000) },
    ],
  },
];

// Seed Caller ID entries (number -> saved name). Users edit these in Settings.
export const callerIdSeed: { number: string; name: string }[] = [
  { number: "+12194027666", name: "cx" },
  { number: "+19086638211", name: "Jacob Office" },
  { number: "+14073501222", name: "Moriel" },
  { number: "+17732946384", name: "PCK Phone" },
];

// The logged-in user's own Twilio number.
export const myNumber = "+17733477668";
