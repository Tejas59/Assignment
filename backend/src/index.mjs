import { handler as getPresignedUrlHandler } from "./presignedUrl.mjs";
import { handler as processPromptHandler } from "./processPrompt.mjs";

export const handler = async (event) => {
  const path = event.rawPath || event.path || "";
  const method = event.requestContext?.http?.method || event.httpMethod;

  if (path.includes("get-presigned-url") && method === "POST") {
    return await getPresignedUrlHandler(event);
  }

  if (path.includes("process-prompt") && method === "POST") {
    return await processPromptHandler(event);
  }

  return {
    statusCode: 404,
    body: JSON.stringify({ message: "Route not found" }),
  };
};
