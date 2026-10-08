const WPS_FORM_URL = "https://f-api.kdocs.cn/ksform/api/v3/campaign/sxSlOXwx";
const WPS_FIELD_NAME = "qajr6y";
const WPS_FIELD_PAPER_A = "lmwshw";
const WPS_FIELD_PAPER_B = "zuo3h5";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    return res.status(204).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method not allowed" });
  }

  const payload = req.body || {};
  const essays = payload.essays || {};

  try {
    const configRes = await fetch(WPS_FORM_URL);
    if (!configRes.ok) {
      return res.status(502).json({ ok: false, error: "wps config failed" });
    }
    const config = await configRes.json();
    const data = config.data || {};
    const token = data.token || "";
    const editVersion = data.editVersion || 0;

    const answerJson = {
      answers: {
        [WPS_FIELD_NAME]: { type: "input", strValue: String(payload.student || "未填写") },
        [WPS_FIELD_PAPER_A]: { type: "input", strValue: String(essays.A || "") },
        [WPS_FIELD_PAPER_B]: { type: "input", strValue: String(essays.B || "") }
      },
      consumeTime: 1
    };

    const submitRes = await fetch(WPS_FORM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answerJson,
        phoneNumber: "",
        editVersion,
        token
      })
    });
    const submitData = await submitRes.json();

    if (!submitRes.ok || submitData.code !== 0) {
      return res.status(502).json({ ok: false, error: "wps submit failed", detail: submitData });
    }

    return res.status(200).json({
      ok: true,
      code: submitData.code,
      aid: (submitData.data || {}).aid || ""
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: String(error) });
  }
}
