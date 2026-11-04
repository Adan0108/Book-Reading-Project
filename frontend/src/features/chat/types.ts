export interface Conversation {
  id: number;
  authorId: number;
  memberId: number;
  title: string;
  canRead: boolean;
  canSend: boolean;
  unread: number;
}
export interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: number;
  text: string;
  createdAt: string;
  clientId: string;
}
