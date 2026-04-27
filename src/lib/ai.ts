import { GoogleGenAI, Type } from "@google/genai";

// Standard error messages for consistent UI feedback
export function getAIErrorMessage(error: any): string {
  const errorString = String(error?.message || error || "");
  
  if (errorString.includes("429") || errorString.toLowerCase().includes("quota")) {
    return "API Quota Exceeded. The free tier limit has been reached. Please try again later or check your AI provider quota.";
  }
  
  if (errorString.includes("401") || errorString.includes("403") || errorString.toLowerCase().includes("api key") || errorString.toLowerCase().includes("suspended")) {
    return "API Key Error: Your API Key is either invalid, suspended, or missing. Please check your .env file.";
  }

  if (errorString.includes("500") || errorString.includes("503")) {
    return "AI Server Error. The AI providers servers are currently busy or experiencing issues. Please try again in a moment.";
  }

  if (errorString.toLowerCase().includes("timeout")) {
    return "Request Timed Out. The document might be too complex or the connection is slow. Try again with a smaller file.";
  }

  if (errorString.toLowerCase().includes("network") || errorString.toLowerCase().includes("fetch") || errorString.toLowerCase().includes("reset")) {
    return "Network/Connection Error. The connection was reset or interrupted. This often happens with large files or unstable internet. Please try a smaller file or check your connection.";
  }

  return `AI Error: ${errorString.length > 100 ? errorString.substring(0, 100) + "..." : errorString}`;
}

export async function refinePurpose(text: string, agency: string, context?: string) {
  try {
    const response = await fetch("/api/refine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, agency, context })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to refine purpose");
    }

    const result = await response.json();
    return result.options;
  } catch (error) {
    console.error("Client Refiner Error:", error);
    throw error;
  }
}

export async function extractSecClauses(headline: string, fileData: string, mimeType: string) {
  try {
    const response = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ headline, fileData, mimeType })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to extract clauses");
    }

    const result = await response.json();
    console.log("Gemini Extraction Success (via Proxy):", result);
    return result;
  } catch(error: any) {
    console.error("Gemini Extraction Error:", error);
    
    const msg = error.message || String(error);
    if (msg.includes("Failed to fetch") || msg.includes("ERR_CONNECTION_RESET")) {
      throw new Error("Network Error: The connection was interrupted. This often happens with large files. Please try a smaller file or check your connection.");
    }
    
    throw error;
  }
}
