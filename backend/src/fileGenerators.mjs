import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import ExcelJS from "exceljs";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Document, Paragraph, Packer } from "docx";

export async function generateDocxAndUpload(content, s3, bucket) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    console.error("❌ Failed to parse DOCX JSON:", err);
    parsed = {
      title: "Document",
      content: [{ type: "paragraph", text: content }],
    };
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: buildDocxContent(parsed),
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const key = `results/${parsed.title || Date.now()}.docx`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })
  );

  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: 600,
  });
}

function buildDocxContent(parsed) {
  const children = [];

  if (parsed.title) {
    children.push(
      new Paragraph({
        text: parsed.title,
        heading: "Heading1",
        spacing: { after: 300 },
      })
    );
  }

  if (Array.isArray(parsed.content)) {
    for (const block of parsed.content) {
      if (block.type === "paragraph") {
        children.push(new Paragraph(block.text));
      } else if (block.type === "list" && Array.isArray(block.items)) {
        for (const item of block.items) {
          children.push(
            new Paragraph({
              text: item,
              bullet: { level: 0 },
            })
          );
        }
      }
    }
  } else {
    children.push(new Paragraph(JSON.stringify(parsed, null, 2)));
  }

  return children;
}

export async function generateExcelAndUpload(content, s3, bucket) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    console.error("❌ Failed to parse Excel JSON:", err);
    parsed = { sheets: [{ name: "Sheet1", data: [{ Content: content }] }] };
  }

  const workbook = new ExcelJS.Workbook();

  for (const sheetDef of parsed.sheets || []) {
    const sheet = workbook.addWorksheet(sheetDef.name || "Sheet1");

    if (Array.isArray(sheetDef.data) && sheetDef.data.length > 0) {
      sheet.columns = Object.keys(sheetDef.data[0]).map((key) => ({
        header: key,
        key,
      }));
      sheet.addRows(sheetDef.data);
    } else {
      sheet.addRow(["No data available"]);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const key = `results/${parsed.filename || Date.now() + ".xlsx"}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
  );

  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: 600,
  });
}

export async function generatePdfAndUpload(content, s3, bucket) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    console.error("❌ Failed to parse PDF JSON:", err);
    parsed = {
      title: "Generated Report",
      sections: [{ heading: "Content", content }],
    };
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const titleFontSize = 18;
  const headingFontSize = 14;
  const bodyFontSize = 11;
  let y = height - 50;

  if (parsed.title) {
    page.drawText(parsed.title, {
      x: 50,
      y,
      size: titleFontSize,
      font,
      color: rgb(0, 0, 0.8),
    });
    y -= 40;
  }

  for (const section of parsed.sections || []) {
    if (y < 100) {
      y = height - 50;
      pdfDoc.addPage();
    }

    if (section.heading) {
      page.drawText(section.heading, {
        x: 50,
        y,
        size: headingFontSize,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= 20;
    }

    const contentLines = splitTextIntoLines(section.content, 90);
    for (const line of contentLines) {
      page.drawText(line, {
        x: 60,
        y,
        size: bodyFontSize,
        font,
        color: rgb(0, 0, 0),
      });
      y -= 15;
    }

    y -= 20;
  }

  const pdfBytes = await pdfDoc.save();
  const key = `results/${parsed.title || Date.now()}.pdf`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(pdfBytes),
      ContentType: "application/pdf",
    })
  );

  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: 600,
  });
}

function splitTextIntoLines(text, maxCharsPerLine) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + word).length > maxCharsPerLine) {
      lines.push(currentLine.trim());
      currentLine = word + " ";
    } else {
      currentLine += word + " ";
    }
  }
  if (currentLine) lines.push(currentLine.trim());
  return lines;
}
