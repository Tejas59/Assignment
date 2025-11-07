
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

const ChatMessage = ({
  message,
  isAiLoading,
}: {
  message: { role: "user" | "assistant"; content: string };
  isAiLoading?: boolean;
}) => {
  return (
    <div
      className={cn(
        "flex w-full items-start gap-4 p-4 rounded-lg",
        message.role === "user"
          ? "bg-blue-50 self-end"
          : "bg-muted/50 self-start",
        "mb-4 max-w-xl"
      )}
    >
      {isAiLoading ? (
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
          <span className="text-gray-500">AI is typing...</span>
        </div>
      ) : (
        <ReactMarkdown>{message.content}</ReactMarkdown>
      )}
    </div>
  );
};

export default ChatMessage;
