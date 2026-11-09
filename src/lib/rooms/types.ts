export type RoomStatus = "collecting" | "drawing" | "ended";
export type EndMode = "all" | "count";
/**
 * anonymous: nicknames are asked for but the final list hides them (default)
 * named:     the final list shows who posted each topic, once the host
 *            reveals the authors (答え合わせ)
 * none:      no nicknames at all
 */
export type NameMode = "anonymous" | "named" | "none";

export interface RoomSummary {
  code: string;
  status: RoomStatus;
  endMode: EndMode;
  drawLimit: number | null;
  nameMode: NameMode;
  drawCount: number;
  expiresAt: string;
  /**
   * Named rooms: how many reveal items, counted in list order, show their
   * author. The rest stay hidden until the host reveals them.
   */
  authorsShown: number;
}

export interface OwnTopic {
  id: string;
  text: string;
  /** Whether the host has drawn this topic. Only ever sent to its author. */
  drawn: boolean;
}

export interface DrawnCard {
  id: string;
  text: string;
  order: number;
  rare: boolean;
}

export interface RevealItem {
  id: string;
  text: string;
  /** Draw order, or null if the topic was never drawn. */
  order: number | null;
  rare: boolean;
  /**
   * Only filled in named rooms, and only for the first `authorsShown`
   * items in list order.
   */
  author: string | null;
}

export interface RoomCounts {
  participants: number;
  topics: number;
  remaining: number;
}

/** What one device is allowed to see. Topic texts stay hidden until the release. */
export interface RoomView {
  role: "host" | "participant";
  room: RoomSummary;
  me: { id: string; nickname: string | null };
  counts: RoomCounts;
  myTopics: OwnTopic[];
  /** Host only: the cards drawn so far, newest last. */
  drawn: DrawnCard[];
  /** Everyone, once the room has ended and its reveal time has come. */
  reveal: RevealItem[] | null;
  /** When the list is released (server clock). Set when the room ends. */
  revealAt: string | null;
  /** The server clock when this view was read, so phones can count down together. */
  serverNow: string;
  /** Changes whenever anything in this view could have changed. */
  version: number;
}

/** The answer to a poll whose version is still current. */
export interface RoomUnchanged {
  unchanged: true;
  version: number;
}

export interface DrawResult {
  card: DrawnCard;
  remaining: number;
  ended: boolean;
  /** Set once the room has ended. */
  revealAt: string | null;
}

export interface RoomPublicInfo {
  code: string;
  status: RoomStatus;
  nameMode: NameMode;
  reveal: RevealItem[] | null;
  revealAt: string | null;
  serverNow: string;
}
