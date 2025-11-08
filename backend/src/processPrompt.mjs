import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import mammoth from "mammoth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Pinecone } from "@pinecone-database/pinecone";
import {
  generateDocxAndUpload,
  generateExcelAndUpload,
  generatePdfAndUpload,
} from "./fileGenerators.mjs";
import OpenAI from "openai";
const require = createRequire(import.meta.url);

const PDFParser = require("pdf2json");

const s3 = new S3Client({
  region: process.env.AWS_REGION_INDIA,
});
const bucket = process.env.UPLOAD_BUCKET;
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});
const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
export const handler = async (event) => {
  try {
    const { prompt, files, modelType } = JSON.parse(event.body);
    if (!prompt) return response(400, { error: "Missing prompt" });
    const newUpload = files && files.length > 0;
    if (newUpload) {
      await cleanupS3FilesExcept(files.map((f) => f.key));
      await cleanupPineconeIndex();
    }
    let allText = "";
    if (newUpload) {
      allText = await extractTextFromFiles(files);
    }
    if (newUpload) {
      const chunks = chunkText(allText, 1500);
      const embeddings = await Promise.all(
        chunks.map(async (chunk) => {
          const result = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: chunk,
          });
          return {
            id: `chunk-${Date.now()}-${Math.random()}`,
            values: result.data[0].embedding,
            metadata: { text: chunk },
          };
        })
      );
      await index.upsert(embeddings);
    }
    const userEmbeddingRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: prompt,
    });
    const userEmbedding = userEmbeddingRes.data[0].embedding;
    const queryRes = await index.query({
      vector: userEmbedding,
      topK: 3,
      includeMetadata: true,
    });
    const context = queryRes.matches.map((m) => m.metadata.text).join("\n\n");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const detectDownloadPrompt = `
    Based on the following user message, decide if they want a downloadable file
    or just a normal text response. If a file, return only one word from ["pdf", "excel", "doc"].
    If not, return only "text". No explanation.
    User message: "${prompt}"
    `;
    const detectResponse = await openai.responses.create({
      model: "gpt-4o-mini",
      input: detectDownloadPrompt,
    });

    const outputType = detectResponse.output_text.trim();
    const fullPrompt = `
    You are a file generation assistant. Based on the user's request and provided context,
    you will generate a structured response in **JSON** that can be used to create a downloadable file.
    Follow these rules strictly:
    1 Always return **only valid JSON** — no markdown, no explanations, no commentary.
    2 Choose one of the following formats depending on the user's request:
    ---
    **For Word / DOCX output** (when user says: "word file", "doc", "work instruction", "document", etc.)  
    Return exactly in this format:
    {
    "type": "docx",
    "title": "Document Title",
    "content": [
        { "type": "paragraph", "text": "..." },
        { "type": "paragraph", "text": "..." },
        { "type": "list", "items": ["...", "..."] }
    ]
    }
    ---
    **For Excel / Sheet output** (when user says: "excel", "sheet", "checklist", "table", etc.)  
    Return exactly in this format:
    {
    "type": "excel",
    "filename": "filename.xlsx",
    "sheets": [
        {
        "name": "Sheet1",
        "data": [
            { "Column1": "Value1", "Column2": "Value2" },
            { "Column1": "Value3", "Column2": "Value4" }
        ]
        }
    ]
    }
    ---
    **For PDF output** (when user says: "pdf", "report", "summary pdf", etc.)  
    Return exactly in this format:
    {
    "type": "pdf",
    "title": "PDF Title",
    "sections": [
        { "heading": "Section 1", "content": "..." },
        { "heading": "Section 2", "content": "..." }
    ]
    }
    ---
    **For plain text (no file)** (when user just asks a normal question):  
    Return exactly in this format:
    {
    "type": "text",
    "content": "Normal conversational text answer here."
    }
    ---
    Now, use the provided user message and context to produce the appropriate response.
    User message:
    ${prompt}
    Relevant context:
    ${context}
    `;
    let aiResponseText;
    if (modelType === "openai") {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful AI assistant generating structured responses.",
          },
          {
            role: "user",
            content: fullPrompt,
          },
        ],
      });
      aiResponseText = completion.choices[0].message.content;
    } else {
      const result = await model.generateContent(fullPrompt);
      aiResponseText = result.response.text();
    }
    const outputText = aiResponseText.replace(/```json|```/g, "").trim();
    if (outputType === "doc") {
      const fileUrl = await generateDocxAndUpload(outputText, s3, bucket);
      return response(200, { message: "DOC generated", downloadUrl: fileUrl });
    } else if (outputType === "excel") {
      const fileUrl = await generateExcelAndUpload(outputText, s3, bucket);
      return response(200, {
        message: "Excel generated",
        downloadUrl: fileUrl,
      });
    } else if (outputType === "pdf") {
      const fileUrl = await generatePdfAndUpload(outputText, s3, bucket);
      return response(200, { message: "PDF generated", downloadUrl: fileUrl });
    } else {
      let textResult;
      const parsed = JSON.parse(outputText);
      textResult = parsed?.content ?? outputText;
      return response(200, { message: "Text answer", result: textResult });
    }
  } catch (err) {
    console.error("❌ Error:", err);
    return response(500, { error: err.message });
  }
};
async function extractTextFromFiles(files) {
  let allText = "";
  for (const file of files) {
    const res = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: file.key })
    );
    const buffer = await streamToBuffer(res.Body);
    if (file.name.endsWith(".pdf")) {
      const text = await extractTextFromPdf(buffer);
      allText += text;
    } else if (file.name.endsWith(".docx") || file.name.endsWith(".doc")) {
      const data = await mammoth.extractRawText({ buffer });
      allText += data.value;
    }
  }
  return allText;
}
async function cleanupS3FilesExcept(currentKeys) {
  const list = await s3.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: "uploads/" })
  );
  if (!list.Contents) return;
  for (const obj of list.Contents) {
    if (!currentKeys.includes(obj.Key)) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }));
    }
  }
}
async function cleanupPineconeIndex() {
  try {
    const stats = await index.describeIndexStats();
    if (stats.totalRecordCount > 0) {
      await index._deleteAll();
    }
  } catch (err) {
    console.warn("⚠️ Pinecone cleanup skipped:", err.message);
  }
}
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}
function chunkText(text, size) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size)
    chunks.push(text.slice(i, i + size));
  return chunks;
}
function response(status, body) {
  return {
    statusCode: status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
      "Access-Control-Allow-Headers": "*",
    },
    body: JSON.stringify(body),
  };
}

export async function extractTextFromPdf(buffer) {
  return new Promise((resolve, reject) => {
    try {
      const pdfParser = new PDFParser();

      pdfParser.on("pdfParser_dataError", (errData) => {
        console.error("❌ PDF parse error:", errData.parserError);
        reject(errData.parserError);
      });

      pdfParser.on("pdfParser_dataReady", (pdfData) => {
        try {
          const texts = [];
          for (const page of pdfData.Pages || []) {
            for (const t of page.Texts || []) {
              const raw = t.R.map((r) => r.T).join("");
              let decoded;
              try {
                decoded = decodeURIComponent(raw);
              } catch {
                decoded = raw;
              }
              texts.push(decoded);
            }
          }
          resolve(texts.join(" "));
        } catch (e) {
          reject(e);
        }
      });

      pdfParser.parseBuffer(buffer);
    } catch (err) {
      reject(err);
    }
  });
}
