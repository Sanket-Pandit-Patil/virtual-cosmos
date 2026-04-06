export type ChatSystemVariant = "connect" | "disconnect" | "peer_left";

export type ChatRow =
  | {
      kind: "system";
      id: string;
      text: string;
      ts: number;
      variant: ChatSystemVariant;
    }
  | {
      kind: "user";
      fromId: string;
      fromName: string;
      text: string;
      ts: number;
    };
