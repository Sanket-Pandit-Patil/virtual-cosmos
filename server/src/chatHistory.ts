/** In-memory chat log per pair room for the lifetime of the Node process. */

export type StoredChatMessage = {
  fromId: string;
  fromName: string;
  text: string;
  ts: number;
};

const MAX_MESSAGES_PER_ROOM = 400;

const roomHistory = new Map<string, StoredChatMessage[]>();

export function appendChatMessage(roomId: string, msg: StoredChatMessage): void {
  let list = roomHistory.get(roomId);
  if (!list) {
    list = [];
    roomHistory.set(roomId, list);
  }
  list.push(msg);
  if (list.length > MAX_MESSAGES_PER_ROOM) {
    list.splice(0, list.length - MAX_MESSAGES_PER_ROOM);
  }
}

export function getChatHistory(roomId: string): StoredChatMessage[] {
  const list = roomHistory.get(roomId);
  return list ? [...list] : [];
}
