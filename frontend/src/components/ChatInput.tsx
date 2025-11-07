"use client";
import React, { useEffect, useRef, useState, type SetStateAction } from "react";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Paperclip, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import axios from "axios";

interface ChatInputProps {
  isLoading?: boolean;
  hideFileInputAndQuizMode?: boolean;
  handleSendMessage: (
    uploadedFileKeys?: { key: string; name: string }[]
  ) => void;
  input: string;
  setInput: React.Dispatch<SetStateAction<string>>;
}

interface UploadFile {
  id: string;
  file: File;
}

const ChatInput = ({
  isLoading,
  input,
  setInput,
  handleSendMessage,
}: ChatInputProps) => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileClick = () => {
    if (!isLoading) fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter((file) =>
      [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ].includes(file.type)
    );

    if (validFiles.length !== selectedFiles.length) {
      setError("Only PDF or DOC/DOCX files are allowed.");
    } else {
      const newUploads = validFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
      }));

      setFiles((prev) => [...prev, ...newUploads]);
    }
  };

  const handleRemoveFileClick = (id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const uploadedFileKeys= [];
    if (files && files.length >= 0) {
      for (const obj of files) {
        const presignRes = await axios.post(
          "https://cvrob3x3t2.execute-api.ap-south-1.amazonaws.com/default/get-presigned-url",
          {
            fileName: obj.file.name,
            contentType: obj.file.type,
          },
          {
            headers: { "Content-Type": "application/json" },
          }
        );

        const { uploadUrl, key } = presignRes.data;

        await axios.put(uploadUrl, obj.file, {
          headers: {
            "Content-Type": obj.file.type,
          },
        });

        uploadedFileKeys.push({ key, name: obj.file.name });
      }
    }
    handleSendMessage(uploadedFileKeys);
    setInput("");
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [input]);

  return (
    <div
      className={cn(
        "w-full max-w-4xl rounded-xl bg-[#f4f4f6] py-4 px-4 shadow-[0_-1px_6px_rgba(0,0,0,0.05)] transition-all duration-300"
      )}
    >
      <form onSubmit={handleSubmit} className="w-full">
        <input
          type="file"
          accept=".pdf,.doc,.docx"
          ref={fileInputRef}
          className="hidden"
          multiple
          onChange={handleFileChange}
        />

        <div className="flex flex-wrap gap-1">
          {files &&
            files.map(({ id, file }) => {
              return (
                <div
                  key={id}
                  className="flex items-center justify-between bg-white border rounded-md p-2 mb-2 text-sm text-gray-700 max-w-60"
                >
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFileClick(id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
        </div>

        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}

        <Textarea
          ref={textareaRef}
          placeholder={
            files
              ? "Write your question about the uploaded PDF..."
              : "Ask anything about your PDF document"
          }
          className="w-full resize-none overflow-hidden text-sm bg-transparent border-none outline-none right-0 focus:outline-none focus:border-none focus:ring-0 shadow-none px-2 py-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          rows={1}
        />

        <div className="mt-2 flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={isLoading}
              onClick={handleFileClick}
              className="h-9 w-9 rounded-md border border-gray-300"
            >
              <Paperclip className="h-5 w-5 text-gray-600" />
            </Button>
          </div>

          <Button
            type="submit"
            variant="ghost"
            size="icon"
            disabled={isLoading || !input}
            className={cn(
              "bg-blue-600 text-white h-9 w-9 p-2 rounded-md ",
              !input.trim() && !files && "opacity-50 cursor-not-allowed"
            )}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ChatInput;
