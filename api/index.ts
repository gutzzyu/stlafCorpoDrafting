import express from "express";
import Groq from "groq-sdk";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// Increase limit for large PDF base64 uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const groqApiKey = process.env.GROQ_API_KEY || "";
const groq = new Groq({ apiKey: groqApiKey || "dummy-key" });

const geminiApiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenAI({ apiKey: geminiApiKey || "dummy-key" });

// API Endpoint: Refine Purpose (using Groq)
app.post("/api/refine", async (req, res) => {
  try {
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: "GROQ_API_KEY is missing." });
    }
    const { text, agency, context } = req.body;
    const isSec = agency === 'SEC';
    
    const prompt = `Refine and paraphrase the following legal text for a ${isSec ? "Secretary's Certificate Board Resolution" : "Special Power of Attorney (SPA)"}. 
    The text should be formal, precise, and professional. 
    ${isSec ? 'It should follow standard corporate legal drafting conventions (e.g. starting with "That").' : 'It MUST always start with the word "To".'}
    Agency: ${agency}
    ${context ? `Context: ${context}` : ""}
    Original Text: ${text}
    
    Provide 3 options in the following JSON format:
    {
      "options": [
        { "label": "Precise & Formal", "text": "..." },
        { "label": "Comprehensive Scope", "text": "..." },
        { "label": "Direct & Concise", "text": "..." }
      ]
    }`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a professional legal drafter. Always respond in valid JSON format."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" }
    });

    const output = JSON.parse(chatCompletion.choices[0]?.message?.content || "{}");
    res.json(output);
  } catch (error: any) {
    console.error("Groq Refine Error:", error);
    res.status(500).json({ error: error.message || "Failed to refine text" });
  }
});

// API Endpoint: Extract SEC Clauses (using Gemini)
app.post("/api/extract", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is missing." });
    }
    const { headline, fileData, mimeType } = req.body;

    const prompt = `SECRETARY'S CERTIFICATE EXTRACTOR:
Your task is to find and extract ALL clauses specifically listed under the Board Resolution section titled: "${headline}".

RULES FOR EXTRACTION:
1. CONTINUITY: Merge rows and text that span across page boundaries into one continuous entry.
2. TEXT CLEANING: Strip the word "RESOLVED", "RESOLVED FURTHER", "RESOLVED FINALLY", or similar prefixes. The "text" field should contain only the main instruction.
3. TABLE PLACEMENT (CRITICAL): Only attach a "tableData" array to the specific clause that introduces it. Clauses typically introduce tables by ending with a colon ":" or the words "the following:".
4. ABSOLUTELY NO DUPLICATION: Do NOT repeat table data in multiple objects. If clause A contains a table, and clause B follows it (e.g., a "binding/effect" clause), clause B MUST have "tableData": null. Repeating the same data in multiple objects is a failure.
5. NO HALLUCINATION: If a clause does not clearly contain or introduce a table, its "tableData" field MUST be null. Never return the word "null" as a string inside an array.
6. WORDING: Keep the specific legal wording of the resolution text precisely.

SCOPE:
- Extract everything belonging to this specific agenda item until the next major heading.
- Return an empty array [] if the headline "${headline}" is not found.

FORMAT: Respond ONLY with a valid JSON array of objects.
`;

    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType, data: fileData } },
          { text: prompt }
        ]
      }],
      config: {
        responseMimeType: "application/json",
      }
    });

    const resultText = response.text;
    const parsed = JSON.parse(resultText);
    res.json(parsed);
  } catch (error: any) {
    console.error("Gemini Extraction Error:", error);
    res.status(500).json({ error: error.message || "Failed to extract clauses" });
  }
});

export default app;
