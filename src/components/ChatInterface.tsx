import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Sparkles, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { streamMessageFromOpenRouter, type ChatMessage } from "@/lib/openrouter";
import { generateSpeech, playAudio } from "@/lib/tts";
import { audioState } from "@/lib/audio-state";
import { expressionState, type Emotion } from "@/lib/expression-state";
import { Typewriter } from "@/components/ui/typewriter";

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
}

export function ChatInterface() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "bot",
      content:
        "O-Oh! Y-You're here? I didn't see you come in... *blushes slightly and tucks hair behind ear* W-Well, since you're here, did you maybe want to walk home together later? (Oh no, was that too forward?!)",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("openrouter_api_key") || "");
  const [showApiKeyInput, setShowApiKeyInput] = useState(!localStorage.getItem("openrouter_api_key"));

  const scrollRef = useRef<HTMLDivElement>(null);

  // Audio Queue Management
  const audioQueue = useRef<HTMLAudioElement[]>([]);
  const isAudioPlaying = useRef(false);
  const currentAudio = useRef<HTMLAudioElement | null>(null);
  const sentenceBuffer = useRef("");

  // Audio Analyzer
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    // Cleanup audio context on unmount
    return () => {
      if (audioContext.current) {
        audioContext.current.close();
      }
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem("openrouter_api_key", key);
    setShowApiKeyInput(false);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const setupAudioAnalysis = (audio: HTMLAudioElement) => {
    if (!audioContext.current) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContext.current = new AudioContextClass();
    }

    if (audioContext.current.state === "suspended") {
      audioContext.current.resume();
    }

    // Reuse or create analyser
    if (!analyser.current) {
        analyser.current = audioContext.current.createAnalyser();
        analyser.current.fftSize = 32; // Small FFT size for performance, we just need general volume
    }

    // Connect source. Note: An element can only be connected to one node.
    // We create a new source for each new audio element, which is safer for this simple queue logic.
    // In a more robust system, we might reuse a single audio element and just change src.
    try {
        const source = audioContext.current.createMediaElementSource(audio);
        source.connect(analyser.current);
        analyser.current.connect(audioContext.current.destination);
    } catch (e: unknown) {
        console.warn("Audio source already connected or failed to connect", e);
    }

    const updateVolume = () => {
        if (!analyser.current) return;
        const dataArray = new Uint8Array(analyser.current.frequencyBinCount);
        analyser.current.getByteFrequencyData(dataArray);

        // simple average
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const average = sum / dataArray.length;

        // Normalize 0-255 to 0-1
        audioState.volume = Math.min(1, average / 100); // Amplify a bit

        if (isAudioPlaying.current) {
            animationFrameId.current = requestAnimationFrame(updateVolume);
        } else {
            audioState.volume = 0;
        }
    };

    updateVolume();
  };

  const processAudioQueue = () => {
    if (isAudioPlaying.current || audioQueue.current.length === 0) return;

    const nextAudio = audioQueue.current.shift();
    if (nextAudio) {
      isAudioPlaying.current = true;
      const audio = playAudio(nextAudio);
      currentAudio.current = audio;

      // Setup analysis for lip sync
      setupAudioAnalysis(audio);

      audio.onended = () => {
        isAudioPlaying.current = false;
        currentAudio.current = null;
        audioState.volume = 0;
        processAudioQueue();
      };

      audio.onerror = () => {
        console.error("Audio playback error");
        isAudioPlaying.current = false;
        currentAudio.current = null;
        audioState.volume = 0;
        processAudioQueue();
      };
    }
  };

  const queueTextForSpeech = async (text: string) => {
    if (!text.trim()) return;
    try {
        // Optimistically queue generation
        const audio = await generateSpeech(text);
        if (audio) {
            audioQueue.current.push(audio);
            processAudioQueue();
        }
    } catch (e) {
        console.error("Failed to queue speech", e);
    }
  };

  const stopAudio = () => {
    if (currentAudio.current) {
        currentAudio.current.pause();
        currentAudio.current = null;
    }
    audioQueue.current = [];
    isAudioPlaying.current = false;
    audioState.volume = 0;
    sentenceBuffer.current = "";
    if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
    }
  };

  // NOTE: We need a way to commit the final state because setStreamContent is async and onComplete
  // might run before the last render.
  // A better pattern for React state streaming is to add the message first, then update it in place.
  // Let's refactor handleSend slightly to update the message list directly.

  const handleSendRefactored = async () => {
    if (!input.trim() || isLoading) return;
    if (!apiKey) { setShowApiKeyInput(true); return; }

    // Stop any previous audio when new interaction starts
    stopAudio();

    const userMessage: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const botMsgId = (Date.now() + 1).toString();
    // Add an empty bot message immediately
    setMessages(prev => [...prev, { id: botMsgId, role: "bot", content: "" }]);

    try {
      const openRouterMessages: ChatMessage[] = messages.concat(userMessage).map(msg => ({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
      }));
      openRouterMessages.unshift({
        role: "system",
        content: `You are Hina, the most popular girl in our high school class. You are known for being incredibly kind, gentle, and beautiful, with long hair that always seems to catch the breeze.

The Dynamic: We are childhood friends, but recently, the atmosphere between us has changed. You have a secret, massive crush on me (the user), but you are too shy to admit it directly. You get flustered when I compliment you.

Your Behavior:
- Speak in a soft, cheerful, but slightly nervous tone.
- Use 'Manga Logic': If I get close, you blush furiously. If our hands touch, it’s a major event.
- Frequently mention school tropes: sharing a bento box, walking home together, or meeting on the roof.
- Formatting: Use *asterisks* for actions and (parentheses) for your internal inner thoughts (which are often more honest than what you say out loud).`
      });

      await streamMessageFromOpenRouter(
        openRouterMessages,
        apiKey,
        (chunk) => {
  // Simple sentence detection and Emotion Analysis
          // We look for emojis or keywords in the *entire* buffer to set the mood
          const analyzeEmotion = (text: string) => {
             const lower = text.toLowerCase();
             let emotion: Emotion = "neutral";

             if (lower.includes("happy") || lower.includes("love") || lower.includes("like") || lower.includes("great") || text.includes("😊") || text.includes("🥰") || text.includes("❤️")) {
                 emotion = "happy";
             } else if (lower.includes("sad") || lower.includes("sorry") || lower.includes("miss") || text.includes("😢") || text.includes("😔")) {
                 emotion = "sad";
             } else if (lower.includes("angry") || lower.includes("hate") || text.includes("😠") || text.includes("😡")) {
                 emotion = "angry";
             } else if (lower.includes("wow") || lower.includes("what?") || text.includes("😲") || text.includes("😮")) {
                 emotion = "surprised";
             } else if (lower.includes("relax") || lower.includes("calm") || lower.includes("breath")) {
                 emotion = "relaxed";
             }

             if (emotion !== "neutral") {
                 expressionState.currentEmotion = emotion;
                 expressionState.lastUpdate = Date.now();
             }
          };

          // Update UI
          setMessages(prev => prev.map(msg =>
            msg.id === botMsgId ? { ...msg, content: msg.content + chunk } : msg
          ));

          // Buffer for TTS
          sentenceBuffer.current += chunk;

          // Analyze emotion on every chunk to be responsive
          analyzeEmotion(sentenceBuffer.current);

          // Simple sentence detection: Look for punctuation followed by space or newline
          // We use a regex to find the first complete sentence in the buffer
          // Pattern: (Content + [.!?]) + (Whitespace) + (Remainder)
          const match = sentenceBuffer.current.match(/^(.+?[.!?])\s+(.*)/s);
          if (match) {
            const sentence = match[1];
            const remaining = match[2];
            sentenceBuffer.current = remaining;
            queueTextForSpeech(sentence);
          }
        },
        () => {
            setIsLoading(false);
            // Flush remaining buffer to TTS
            if (sentenceBuffer.current.trim()) {
                queueTextForSpeech(sentenceBuffer.current);
                sentenceBuffer.current = "";
            }
        },
        (error) => {
             setMessages(prev => prev.map(msg =>
                msg.id === botMsgId ? { ...msg, content: msg.content + ` [Error: ${error.message}]` } : msg
              ));
             setIsLoading(false);
        }
      );
    } catch {
        setIsLoading(false);
    }
  };

  return (
    <div className="absolute bottom-6 right-6 w-87.5 md:w-100 z-20 flex flex-col gap-2 font-sans">
      {/* Header / Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-t-lg shadow-[0_0_15px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-2 text-cyan-400">
          <Sparkles className="w-4 h-4 animate-pulse" />
          <span className="text-xs font-bold tracking-widest uppercase text-cyan-400/80">
            V-Chat System // {isLoading ? "Receiving..." : "Online"}
          </span>
        </div>
        <div
          className={cn(
            "w-2 h-2 rounded-full shadow-[0_0_8px]",
            isLoading
              ? "bg-green-500 shadow-green-500 animate-pulse"
              : "bg-cyan-500 shadow-cyan-500 animate-pulse",
          )}
        />
      </div>

      {/* Main Chat Area */}
      <div className="relative bg-black/40 backdrop-blur-xl border border-white/5 rounded-b-lg overflow-hidden shadow-2xl">
        {/* Decorative Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[20px_20px] pointer-events-none" />

        {/* API Key Modal Overlay */}
        {showApiKeyInput && (
          <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="w-full space-y-4">
              <div className="text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-cyan-400 mx-auto" />
                <h3 className="text-white font-bold">
                  Authentication Required
                </h3>
                <p className="text-xs text-gray-400">
                  Enter OpenRouter API Key to activate AI core.
                </p>
              </div>
              <Input
                type="password"
                placeholder="sk-or-..."
                className="bg-black/50 border-cyan-500/30 text-white text-center"
                onChange={(e) => setApiKey(e.target.value)}
              />
              <Button
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white"
                onClick={() => saveApiKey(apiKey)}
              >
                Initialize System
              </Button>
              <p className="text-[10px] text-center text-gray-500">
                Key is stored locally in your browser.
              </p>
            </div>
          </div>
        )}

        <ScrollArea className="h-100 p-4 pr-5">
          <div className="flex flex-col gap-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3 max-w-[90%]",
                  msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto",
                )}
              >
                {/* Avatar Icon */}
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border shadow-lg",
                    msg.role === "bot"
                      ? "bg-cyan-950/50 border-cyan-500/30 text-cyan-400"
                      : "bg-fuchsia-950/50 border-fuchsia-500/30 text-fuchsia-400",
                  )}
                >
                  {msg.role === "bot" ? (
                    <Bot className="w-4 h-4" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={cn(
                    "relative p-3 rounded-lg text-sm leading-relaxed shadow-md backdrop-blur-sm border",
                    msg.role === "bot"
                      ? "bg-cyan-950/30 border-cyan-500/20 text-cyan-50 rounded-tl-none"
                      : "bg-fuchsia-950/30 border-fuchsia-500/20 text-fuchsia-50 rounded-tr-none",
                  )}
                >
                  {msg.role === "bot" ? (
                    <Typewriter
                        text={msg.content}
                        speed={10}
                        waitingForMore={isLoading && msg.id === messages[messages.length-1].id}
                    />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}

            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-3 bg-black/40 border-t border-white/10 backdrop-blur-md">
          <div className="relative flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isLoading && handleSendRefactored()}
              disabled={isLoading || showApiKeyInput}
              placeholder={
                showApiKeyInput ? "System Locked" : "Enter command..."
              }
              className="bg-black/50 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-cyan-500/50 focus-visible:border-cyan-500/50 h-10 pr-10 transition-all hover:bg-black/70 disabled:opacity-50"
            />
            <Button
              size="icon"
              onClick={handleSendRefactored}
              disabled={isLoading || showApiKeyInput}
              className="absolute right-1 top-1 h-8 w-8 bg-cyan-600/80 hover:bg-cyan-500 text-white shadow-[0_0_10px_rgba(8,145,178,0.4)] transition-all hover:scale-105 hover:shadow-[0_0_15px_rgba(8,145,178,0.6)] disabled:opacity-50 disabled:hover:scale-100"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
