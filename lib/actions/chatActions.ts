"use server";

import { buildChatContext } from "@/lib/data/chatContext";
import { askChat, type ChatMessage } from "@/lib/integrations/anthropicChat";

export async function sendChatMessage(history: ChatMessage[]): Promise<string> {
  const digest = await buildChatContext();
  if (!digest) {
    return "No site is configured yet, so I don't have any data to work from.";
  }

  const result = await askChat(digest, history);
  if (!result.ok) {
    if (result.reason === "missing_api_key") {
      return "The chat assistant isn't configured yet (missing ANTHROPIC_API_KEY).";
    }
    return "Something went wrong reaching the assistant. Try again in a moment.";
  }

  return result.reply;
}
