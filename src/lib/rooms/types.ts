export type RoomStatus = "collecting" | "drawing" | "ended";
export type EndMode = "all" | "count";
/**
 * anonymous: nicknames are asked for but the final list hides them (default)
 * named:     the final list shows who posted each topic
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
}

export interface OwnTopic {
  id: string;
  text: string;
}

export interface DrawnCard {
  id: string;
  text: string;
  order: number;
}

export interface RevealItem {
  id: string;
  text: string;
  /** Draw order, or null if the topic was never drawn. */
  order: number | null;
  /** Only filled when the room's name mode is "named". */
  author: string | null;
}

export interface RoomCounts {
  participants: number;
  topics: number;
  remaining: number;
}

/** What one device is allowed to see. Topic texts stay hidden until the end. */
export interface RoomView {
  role: "host" | "participant";
  room: RoomSummary;
  me: { id: string; nickname: string | null };
  counts: RoomCounts;
  myTopics: OwnTopic[];
  /** Host only: the cards drawn so far, newest last. */
  drawn: DrawnCard[];
  /** Everyone, once the room has ended. */
  reveal: RevealItem[] | null;
}

export interface DrawResult {
  card: DrawnCard;
  remaining: number;
  ended: boolean;
}
