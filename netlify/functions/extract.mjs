import { GoogleGenAI, Type } from "@google/genai";

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    JOBINFO: {
      type: Type.OBJECT,
      properties: {
        JOB_NO: { type: Type.STRING, nullable: true },
        TRPT_NO: { type: Type.STRING, nullable: true },
        TRPT_DATE: {
          type: Type.STRING,
          nullable: true,
          description: "Format YYYY-MM-DD (contoh: 2026-11-12) dari Issue Date di PDF",
        },
        TXT_FINISH: { type: Type.STRING, nullable: true },
        DETOX_URL: { type: Type.STRING, nullable: true },
        TRPT_ASST_NO: { type: Type.STRING, nullable: true },
        TXT_END_USE: { type: Type.STRING, nullable: true },
        ITS_MAPP_NO: { type: Type.STRING, nullable: true },
        SUPPLIER_ID: { type: Type.STRING, nullable: true },
        FACTORY_ID: { type: Type.STRING, nullable: true },
        TRPT_ITEM_DESC: { type: Type.STRING, nullable: true },
        TXT_FABRIC_CONSTRU: { type: Type.STRING, nullable: true },
        TRPT_BUSLINE: { type: Type.STRING, nullable: true },
        TRPT_TESTING_STATUS: { type: Type.STRING, nullable: true },
        TXT_FIBER_CONTENT: { type: Type.STRING, nullable: true },
        TRPT_SPECIFICATION: { type: Type.STRING, nullable: true },
      },
      required: [
        "JOB_NO", "TRPT_NO", "TRPT_DATE", "TXT_FINISH", "DETOX_URL",
        "TRPT_ASST_NO", "TXT_END_USE", "ITS_MAPP_NO", "SUPPLIER_ID",
        "FACTORY_ID", "TRPT_ITEM_DESC", "TXT_FABRIC_CONSTRU", "TRPT_BUSLINE",
        "TRPT_TESTING_STATUS", "TXT_FIBER_CONTENT", "TRPT_SPECIFICATION",
      ],
    },
    JOBANALYSIS: {
      type: Type.OBJECT,
      properties: {
        MSTA_FIELD_1: { type: Type.STRING, nullable: true },
        MSTA_FIELD_4: { type: Type.STRING, nullable: true },
        MSTA_FIELD_6: { type: Type.STRING, nullable: true },
        MSTA_FIELD_2: { type: Type.STRING, nullable: true },
        MSTA_FIELD_7: { type: Type.STRING, nullable: true },
        MSTA_FIELD_8: { type: Type.STRING, nullable: true },
        MSTA_FIELD_5: { type: Type.STRING, nullable: true },
      },
      required: [
        "MSTA_FIELD_1", "MSTA_FIELD_4", "MSTA_FIELD_6", "MSTA_FIELD_2",
        "MSTA_FIELD_7", "MSTA_FIELD_8", "MSTA_FIELD_5",
      ],
    },
    JOBDTLANALYSIS: {
      type: Type.OBJECT,
      properties: {
        STY_NO_S: { type: Type.STRING, nullable: true },
        DTL_PORDER_NO: { type: Type.STRING, nullable: true },
        DTLA_FIELD_2: { type: Type.STRING, nullable: true },
        DTLA_FIELD_4: { type: Type.STRING, nullable: true },
        DTLA_FIELD_5: { type: Type.STRING, nullable: true },
        DTLA_FIELD_7: { type: Type.STRING, nullable: true },
        DTLA_FIELD_8: { type: Type.STRING, nullable: true },
        DTLA_FIELD_9: { type: Type.STRING, nullable: true },
        DTLA_FIELD_10: { type: Type.STRING, nullable: true },
        DTLA_FIELD_11: { type: Type.STRING, nullable: true },
      },
      required: [
        "STY_NO_S", "DTL_PORDER_NO", "DTLA_FIELD_2", "DTLA_FIELD_4",
        "DTLA_FIELD_5", "DTLA_FIELD_7", "DTLA_FIELD_8", "DTLA_FIELD_9",
        "DTLA_FIELD_10", "DTLA_FIELD_11",
      ],
    },
  },
  required: ["JOBINFO", "JOBANALYSIS", "JOBDTLANALYSIS"],
};

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { success: false, error: "GEMINI_API_KEY belum diatur di Environment Variables Netlify." },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Format request tidak valid." }, { status: 400 });
  }

  const { pdfBase64, masterPrompt } = body;
  if (!pdfBase64) {
    return Response.json({ success: false, error: "File PDF tidak ditemukan." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Kirim 1 byte spasi segera agar Netlify membuka stream dan melewati batas timeout 10 detik
      controller.enqueue(encoder.encode(" "));

      try {
        const ai = new GoogleGenAI({ apiKey });
        const systemInstruction = `Kamu adalah sistem ekstraksi data dokumen laporan pengujian laboratorium (Intertek / SanMar Test Report) presisi tinggi.
Ekstrak nilai dari file PDF terlampir dan petakan ke JSON sesuai Aturan Utama pengguna.

ATURAN EKSTRAKSI PENTING:
1. Jika sebuah field di PDF kosong, tidak ada, atau hanya berisi strip kosong, isi dengan null. Jangan mengarang nilai.
2. Untuk TRPT_DATE (Issue Date), konversi ke format ISO YYYY-MM-DD (misal "Nov 12, 2026" -> "2026-11-12").
3. Pertahankan angka nol di depan (leading zeros) pada kode seperti Sew Factory No. (misal "006442" atau "004932") dan Supplier No. (misal "6043" atau "643").
4. Periksa juga bagian "Other/Notes" di PDF jika field seperti Form No., Fabric Mill Item No., atau Product Test Request ID tertulis di sana.
5. Untuk Product Type (DTLA_FIELD_7), rapikan spasi di sekitar tanda hubung agar sesuai daftar standar SanMar jika cocok (contoh: "03-Wovens -All Fibers" -> "03 - Wovens - All Fibers", "01- Knits - All Fibers" -> "01 - Knits - All Fibers").
6. Untuk APPLICANT PROVIDED CARE INSTRUCTION (MSTA_FIELD_5), gabungkan baris-baris instruksi perawatan menjadi satu kalimat dipisahkan koma dan spasi (abaikan label "Sample: A").
7. Untuk field di JOBDTLANALYSIS, kembalikan teks mentah dari PDF apa adanya (termasuk pemisah koma, garis miring, atau titik koma) agar dapat diproses ke bawah oleh injector Excel.`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
            masterPrompt || "Ekstrak data PDF sesuai skema JSON yang ditentukan.",
          ],
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
            temperature: 0,
          },
        });

        const parsed = JSON.parse(response.text);
        controller.enqueue(encoder.encode(JSON.stringify({ success: true, data: parsed })));
      } catch (err) {
        console.error("Extraction error:", err);
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              success: false,
              error: err?.message || "Gagal memproses PDF dengan Gemini API.",
            })
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
};
