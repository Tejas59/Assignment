import { useRef, useState } from "react";
import ChatInput from "./ChatInput";
import ChatMessage from "./ChatMessage";
import { ScrollArea } from "./ui/scroll-area";
import axios from "axios";

const Home = () => {
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [input, setInput] = useState("");
  const [modelType, setModelType] = useState("gemini");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = async (
    uploadedFileKeys: { key: string; name: string }[] = []
  ) => {
    if (!input.trim()) return;

    const userMessage = { role: "user" as const, content: input };
    setMessages((prev) => [...prev, userMessage]);

    setIsAiLoading(true);
    try {
      const res = await axios.post(
        "https://yve9bdv04d.execute-api.ap-south-1.amazonaws.com/Prod/process-prompt",
        {
          prompt: input,
          files: uploadedFileKeys ?? [],
          modelType: modelType,
        }
      );

      const backendResult = res.data;

      if (backendResult.error) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "❌ " + backendResult.error },
        ]);
      } else if (backendResult.downloadUrl) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `✅ ${backendResult.message}. [Click to download](${backendResult.downloadUrl})`,
          },
        ]);
      } else if (backendResult.result) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: backendResult.result },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "⚙️ No response received." },
        ]);
      }
    } catch (err) {
      console.error("❌ API Error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "❌ Something went wrong." },
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex flex-1 flex-col relative ml-0 p-4 md:p-10 lg:p-6">
        <header className="fixed top-0 left-0 right-0 z-10 flex h-14 items-center justify-between shadow-lg bg-background">
          <select
            className="ml-3 p-2 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring focus:ring-blue-500 transition"
            value={modelType}
            onChange={(e) => setModelType(e.target.value)}
          >
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
          </select>
          <div className="w-full max-w-4xl mx-auto px-4 flex justify-center text-center items-center">
            Industrility
          </div>
        </header>

        <div className="flex-1 w-full max-w-4xl mx-auto pt-12 mb-40">
          <ScrollArea className="h-[calc(100vh-8.5rem)]">
            <div className="flex flex-col px-4 pb-30">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-8">
                  <div className="mb-4 h-16 w-16"></div>
                  <h2 className="text-2xl font-bold ">
                    Hi, I&apos;m Industrility AI
                  </h2>
                  <p className="mt-2 text-center text-muted-foreground">
                    How can I help you today
                  </p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <ChatMessage key={index} message={message} />
                ))
              )}
              {isAiLoading && (
                <ChatMessage
                  message={{
                    role: "assistant",
                    content: "Typing...",
                  }}
                  isAiLoading
                />
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>

        <div className="fixed left-0 mb-4 right-0 bottom-0 mx-auto flex px-4 justify-center items-center md:pl-10">
          <ChatInput
            input={input}
            setInput={setInput}
            handleSendMessage={handleSendMessage}
            isLoading={isAiLoading}
          />
        </div>
      </div>
    </div>
  );
};

export default Home;
