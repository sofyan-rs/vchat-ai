export const OPENROUTER_API_URL =
  "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_MODEL = "deepseek/deepseek-r1-0528:free";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function streamMessageFromOpenRouter(
  messages: ChatMessage[],
  apiKey: string,
  onChunk: (content: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
): Promise<void> {
  console.log("Starting stream to OpenRouter...", {
    model: DEFAULT_MODEL,
    messageCount: messages.length,
  });

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "VRM Chatbot",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: messages,
        stream: true, // Enable streaming
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API Error ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        /* ignore */
      }
      throw new Error(errorMessage);
    }

    if (!response.body) {
      throw new Error("Response body is empty");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep the last incomplete line in buffer

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine.startsWith("data: ")) continue;

        const dataStr = trimmedLine.slice(6);
        if (dataStr === "[DONE]") continue;

        try {
          const json = JSON.parse(dataStr);
          const content = json.choices[0]?.delta?.content || "";
          if (content) {
            onChunk(content);
          }
        } catch (e) {
          console.warn("Error parsing stream chunk", e);
        }
      }
    }

    onComplete();
  } catch (error: unknown) {
    console.error("Stream error:", error);
    if (error instanceof Error) {
        onError(error);
    } else {
        onError(new Error(String(error)));
    }
  }
}

// Keep the non-streaming version just in case, or for fallback
export async function sendMessageToOpenRouter(
  messages: ChatMessage[],
  apiKey: string,
): Promise<string> {
  let fullContent = "";
  return new Promise((resolve, reject) => {
    streamMessageFromOpenRouter(
      messages,
      apiKey,
      (chunk) => {
        fullContent += chunk;
      },
      () => resolve(fullContent),
      (err) => reject(err),
    );
  });
}
