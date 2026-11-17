const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    JOBINFO: {
      type: "OBJECT",
      properties: {
        JOB_NO: { type: "STRING", nullable: true },
        TRPT_NO: { type: "STRING", nullable: true },
        TRPT_DATE: { type: "STRING", nullable: true, description: "Format YYYY-MM-DD dari Issue Date di PDF" },
        TXT_FINISH: { type: "STRING", nullable: true },
        DETOX_URL: { type: "STRING", nullable: true },
        TRPT_ASST_NO: { type: "STRING", nullable: true },
        TXT_END_USE: { type: "STRING", nullable: true },
        ITS_MAPP_NO: { type: "STRING", nullable: true },
        SUPPLIER_ID: { type: "STRING", nullable: true },
        FACTORY_ID: { type: "STRING", nullable: true },
        TRPT_ITEM_DESC: { type: "STRING", nullable: true },
        TXT_FABRIC_CONSTRU: { type: "STRING", nullable: true },
        TRPT_BUSLINE: { type: "STRING", nullable: true },
        TRPT_TESTING_STATUS: { type: "STRING", nullable: true },
        TXT_FIBER_CONTENT: { type: "STRING", nullable: true },
        TRPT_SPECIFICATION: { type: "STRING", nullable: true },
      },
      required: [
        "JOB_NO", "TRPT_NO", "TRPT_DATE", "TXT_FINISH", "DETOX_URL",
        "TRPT_ASST_NO", "TXT_END_USE", "ITS_MAPP_NO", "SUPPLIER_ID",
        "FACTORY_ID", "TRPT_ITEM_DESC", "TXT_FABRIC_CONSTRU", "TRPT_BUSLINE",
        "TRPT_TESTING_STATUS", "TXT_FIBER_CONTENT", "TRPT_SPECIFICATION",
      ],
    },
    JOBANALYSIS: {
      type: "OBJECT",
      properties: {
        MSTA_FIELD_1: { type: "STRING", nullable: true },
        MSTA_FIELD_4: { type: "STRING", nullable: true },
        MSTA_FIELD_6: { type: "STRING", nullable: true },
        MSTA_FIELD_2: { type: "STRING", nullable: true },
        MSTA_FIELD_7: { type: "STRING", nullable: true },
        MSTA_FIELD_8: { type: "STRING", nullable: true },
        MSTA_FIELD_5: { type: "STRING", nullable: true },
      },
      required: [
        "MSTA_FIELD_1", "MSTA_FIELD_4", "MSTA_FIELD_6", "MSTA_FIELD_2",
        "MSTA_FIELD_7", "MSTA_FIELD_8", "MSTA_FIELD_5",
      ],
    },
    JOBDTLANALYSIS: {
      type: "OBJECT",
      properties: {
        STY_NO_S: { type: "STRING", nullable: true },
        DTL_PORDER_NO: { type: "STRING", nullable: true },
        DTLA_FIELD_2: { type: "STRING", nullable: true },
        DTLA_FIELD_4: { type: "STRING", nullable: true },
        DTLA_FIELD_5: { type: "STRING", nullable: true },
        DTLA_FIELD_7: { type: "STRING", nullable: true },
        DTLA_FIELD_8: { type: "STRING", nullable: true },
        DTLA_FIELD_9: { type: "STRING", nullable: true },
        DTLA_FIELD_10: { type: "STRING", nullable: true },
        DTLA_FIELD_11: { type: "STRING", nullable: true },
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/extract") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204 });
      }
      if (request.method !== "POST") {
        return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
      }

      try {
        const { pdfBase64, masterPrompt, apiKey, modelName } = await request.json();
        const finalKey = String(env.GEMINI_API_KEY || apiKey || "").replace(/[^\x21-\x7E]/g, "").trim();

        if (!finalKey) {
          return Response.json(
            { success: false, error: "GEMINI_API_KEY belum diisi di halaman web maupun di Cloudflare Variables." },
            { status: 400 }
          );
        }
        if (!pdfBase64) {
          return Response.json({ success: false, error: "Data PDF kosong." }, { status: 400 });
        }

        const model = modelName || "gemini-3.8-flash";
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

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(finalKey)}`;
        const geminiRes = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: [
              {
                parts: [
                  { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
                  { text: masterPrompt || "Ekstrak data PDF sesuai skema JSON yang ditentukan." },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: RESPONSE_SCHEMA,
              temperature: 0,
            },
          }),
        });

        const payload = await geminiRes.json();
        if (!geminiRes.ok) {
          return Response.json(
            { success: false, error: payload?.error?.message || `Gemini API Error (HTTP ${geminiRes.status})` },
            { status: geminiRes.status }
          );
        }

        const jsonText = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!jsonText) {
          return Response.json({ success: false, error: "Respons kosong dari Gemini API." }, { status: 500 });
        }

        return Response.json({ success: true, data: JSON.parse(jsonText) });
      } catch (err) {
        return Response.json(
          { success: false, error: `Worker Error: ${err?.message || "Gagal memproses permintaan"}` },
          { status: 500 }
        );
      }
    }

    return env.ASSETS.fetch(request);
  },
};
